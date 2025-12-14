// app/api/redemptions/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Backwards compatible payloads we may receive from QR scans:
// 1) A URL: https://your-domain.com/r/<shortCode>
// 2) A plain short code: ABC123
// 3) Old JSON payloads (legacy): {"type":"DEAL","dealId":"...","expiresAt":"..."}
type LegacyDealQrPayload = {
  type: "DEAL";
  dealId: string;
  expiresAt?: string;
};

function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function generateUniqueRedemptionShortCode() {
  for (let i = 0; i < 5; i++) {
    const shortCode = makeShortCode(6);
    const exists = await prisma.redemption.findUnique({
      where: { shortCode },
      select: { id: true },
    });
    if (!exists) return shortCode;
  }
  return makeShortCode(8);
}

/**
 * Retry wrapper for SERIALIZATION / transaction conflicts.
 * With SELECT ... FOR UPDATE this is rare, but retries keep things robust.
 */
async function withTxnRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;

      // Prisma can throw P2034 for transaction conflicts/timeouts.
      // Also some Postgres conflicts surface differently; retry is safe for our idempotent flow.
      const code = e?.code;
      const msg = String(e?.message ?? "");
      const shouldRetry =
        code === "P2034" ||
        msg.toLowerCase().includes("serialization") ||
        msg.toLowerCase().includes("deadlock") ||
        msg.toLowerCase().includes("could not serialize access");

      if (!shouldRetry || i === retries - 1) throw e;

      // small backoff
      await new Promise((r) => setTimeout(r, 30 * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Lock deal row + check capacity in the SAME transaction.
 * This prevents the "last redemption" race condition.
 */
async function lockDealAndEnforceCapacity(
  tx: typeof prisma,
  dealId: string
): Promise<{ max: number | null; redeemedCount: number; soldOut: boolean }> {
  // Lock the deal row (Postgres) so only one redemption can pass capacity check at a time.
  // Prisma model names become quoted tables by default: "Deal"
  const rows = await tx.$queryRaw<Array<{ id: string; maxRedemptions: number | null }>>`
    SELECT "id", "maxRedemptions"
    FROM "Deal"
    WHERE "id" = ${dealId}
    FOR UPDATE
  `;

  if (!rows || rows.length === 0) {
    const err: any = new Error("Deal not found");
    err.status = 404;
    err.code = "DEAL_NOT_FOUND";
    throw err;
  }

  const max = rows[0].maxRedemptions;

  // Unlimited if null/undefined/<=0
  if (typeof max !== "number" || max <= 0) {
    return { max: max ?? null, redeemedCount: 0, soldOut: false };
  }

  const redeemedCount = await tx.redemption.count({
    where: { dealId, redeemedAt: { not: null } },
  });

  const soldOut = redeemedCount >= max;
  return { max, redeemedCount, soldOut };
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    if (!bodyText) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    // Accept JSON or plain text
    let rawText = "";
    try {
      const parsed = JSON.parse(bodyText);
      rawText =
        typeof parsed === "string"
          ? parsed
          : parsed?.qrText ||
            parsed?.payload ||
            parsed?.text ||
            parsed?.raw ||
            parsed?.code ||
            bodyText;
    } catch {
      rawText = bodyText.trim();
    }

    rawText = String(rawText ?? "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "QR text is empty" }, { status: 400 });
    }

    // If URL, extract last segment. Otherwise treat as raw short code.
    let scannedCode: string | null = null;

    if (/^https?:\/\//i.test(rawText)) {
      try {
        const u = new URL(rawText);
        const parts = u.pathname.split("/").filter(Boolean);
        scannedCode = parts.length ? parts[parts.length - 1] : null;
      } catch {
        scannedCode = null;
      }
    }

    if (!scannedCode) scannedCode = rawText.trim();
    if (!scannedCode) {
      return NextResponse.json({ error: "QR code is empty" }, { status: 400 });
    }

    // -------------------------
    // LEGACY JSON payload flow
    // -------------------------
    if (scannedCode.startsWith("{") && scannedCode.endsWith("}")) {
      let legacy: LegacyDealQrPayload;

      try {
        legacy = JSON.parse(scannedCode);
      } catch {
        return NextResponse.json({ error: "QR code is not a valid deal code" }, { status: 400 });
      }

      if (legacy.type !== "DEAL" || !legacy.dealId) {
        return NextResponse.json({ error: "QR code is not a valid deal code" }, { status: 400 });
      }

      if (legacy.expiresAt) {
        const expires = new Date(legacy.expiresAt);
        if (Number.isNaN(expires.getTime())) {
          return NextResponse.json({ error: "QR expiry is invalid" }, { status: 400 });
        }
        if (expires < new Date()) {
          return NextResponse.json({ ok: false, status: "EXPIRED", error: "This QR code has expired." }, { status: 410 });
        }
      }

      // ✅ Concurrency-safe: transaction + deal row lock + capacity check + create redeemed record
      return await withTxnRetry(async () => {
        const result = await prisma.$transaction(async (tx) => {
          const { soldOut, max, redeemedCount } = await lockDealAndEnforceCapacity(tx, legacy.dealId);

          if (soldOut) {
            return { kind: "SOLD_OUT" as const, max, redeemedCount };
          }

          const shortCode = await generateUniqueRedemptionShortCode();

          const redemption = await tx.redemption.create({
            data: {
              dealId: legacy.dealId,
              code: scannedCode,          // legacy raw payload
              shortCode,                  // unique human code
              redeemedAt: new Date(),
              // These exist in your schema now; legacy flow doesn't have device info.
              expiresAt: new Date(Date.now() + 5 * 60 * 1000), // short safety ttl for legacy entries
              deviceHash: "legacy",
            } as any,
            select: { id: true, redeemedAt: true, shortCode: true },
          });

          return { kind: "REDEEMED" as const, redemption, max, redeemedCount };
        });

        if (result.kind === "SOLD_OUT") {
          return NextResponse.json(
            { ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." },
            { status: 409 }
          );
        }

        return NextResponse.json(
          {
            ok: true,
            status: "REDEEMED",
            message: "Redemption successful.",
            redemption: { id: result.redemption.id, redeemedAt: result.redemption.redeemedAt },
          },
          { status: 200 }
        );
      });
    }

    // -------------------------
    // NORMAL FLOW (shortCode/code lookup) — CONCURRENCY SAFE
    // -------------------------
    return await withTxnRetry(async () => {
      const out = await prisma.$transaction(async (tx) => {
        const now = new Date();

        // Look up the redemption first (inside the transaction)
        const redemption = await tx.redemption.findFirst({
          where: {
            OR: [{ shortCode: scannedCode }, { code: scannedCode }],
          },
          include: {
            deal: {
              include: {
                merchant: {
                  select: { id: true, name: true, city: true, address: true, phone: true },
                },
              },
            },
          },
        });

        if (!redemption) {
          return { kind: "NOT_FOUND" as const };
        }

        // Expiry (if you have expiresAt in schema)
        if ((redemption as any).expiresAt) {
          const exp = new Date((redemption as any).expiresAt);
          if (!Number.isNaN(exp.getTime()) && exp <= now) {
            // Mark it unusable (optional). We keep it simple: just return expired.
            return { kind: "EXPIRED" as const };
          }
        }

        if (redemption.redeemedAt) {
          return { kind: "ALREADY_REDEEMED" as const, redeemedAt: redemption.redeemedAt };
        }

        // ✅ Lock deal + enforce capacity inside the same transaction
        const { soldOut } = await lockDealAndEnforceCapacity(tx, redemption.dealId);
        if (soldOut) {
          return { kind: "SOLD_OUT" as const };
        }

        // ✅ Single-winner update: only redeem if still unredeemed and not expired
        const updateWhere: any = {
          id: redemption.id,
          redeemedAt: null,
        };

        // also enforce not expired at update time
        if ((redemption as any).expiresAt) {
          updateWhere.expiresAt = { gt: now };
        }

        const updated = await tx.redemption.updateMany({
          where: updateWhere,
          data: {
            redeemedAt: now,
            activeKey: null, // if your schema has activeKey; safe to keep in `as any`
          } as any,
        });

        if (updated.count === 0) {
          // Someone else redeemed it (or it expired) between our read and update
          // Re-check status
          const again = await tx.redemption.findUnique({
            where: { id: redemption.id },
            select: { redeemedAt: true, expiresAt: true },
          });

          if (again?.redeemedAt) {
            return { kind: "ALREADY_REDEEMED" as const, redeemedAt: again.redeemedAt };
          }

          if ((again as any)?.expiresAt && new Date((again as any).expiresAt) <= now) {
            return { kind: "EXPIRED" as const };
          }

          return { kind: "CONFLICT" as const };
        }

        // Fetch redeemedAt for response
        const redeemedRow = await tx.redemption.findUnique({
          where: { id: redemption.id },
          select: { id: true, redeemedAt: true },
        });

        const deal = redemption.deal;
        const original = deal.originalPrice ?? 0;
        const discount = deal.discountValue ?? 0;
        const hasDiscount = discount > 0 && original > 0;
        const discountedPrice = hasDiscount
          ? Math.round(original - (original * discount) / 100)
          : original || null;
        const savingsAmount = hasDiscount && discountedPrice != null ? original - discountedPrice : null;

        return {
          kind: "REDEEMED" as const,
          deal,
          merchant: deal.merchant,
          redemption: { id: redeemedRow!.id, redeemedAt: redeemedRow!.redeemedAt! },
          computed: { discountedPrice, savingsAmount },
        };
      });

      if (out.kind === "NOT_FOUND") {
        return NextResponse.json({ error: "Redemption code not found" }, { status: 404 });
      }

      if (out.kind === "EXPIRED") {
        return NextResponse.json(
          { ok: false, status: "EXPIRED", error: "This QR code has expired." },
          { status: 410 }
        );
      }

      if (out.kind === "ALREADY_REDEEMED") {
        return NextResponse.json(
          {
            ok: false,
            status: "ALREADY_REDEEMED",
            error: "This QR code has already been redeemed.",
            redeemedAt: out.redeemedAt,
          },
          { status: 409 }
        );
      }

      if (out.kind === "SOLD_OUT") {
        return NextResponse.json(
          { ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." },
          { status: 409 }
        );
      }

      if (out.kind === "CONFLICT") {
        return NextResponse.json(
          { ok: false, status: "CONFLICT", error: "Could not redeem. Please try again." },
          { status: 409 }
        );
      }

      // REDEEMED
      return NextResponse.json(
        {
          ok: true,
          status: "REDEEMED",
          message: "Redemption successful.",
          deal: {
            id: out.deal.id,
            title: out.deal.title,
            originalPrice: out.deal.originalPrice,
            discountValue: out.deal.discountValue,
            discountType: out.deal.discountType,
            discountedPrice: out.computed.discountedPrice,
            savingsAmount: out.computed.savingsAmount,
            startsAt: out.deal.startsAt,
            endsAt: out.deal.endsAt,
            maxRedemptions: (out.deal as any).maxRedemptions ?? null,
          },
          merchant: out.merchant,
          redemption: out.redemption,
        },
        { status: 200 }
      );
    });
  } catch (err: any) {
    console.error("Unexpected error in /api/redemptions/confirm:", err);
    return NextResponse.json(
      { error: "Unexpected error confirming redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
