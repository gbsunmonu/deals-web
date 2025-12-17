// app/api/redemptions/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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

async function withTxnRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const code = e?.code;
      const msg = String(e?.message ?? "").toLowerCase();
      const shouldRetry =
        code === "P2034" ||
        msg.includes("serialization") ||
        msg.includes("deadlock") ||
        msg.includes("could not serialize access");

      if (!shouldRetry || i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 30 * (i + 1)));
    }
  }
  throw lastErr;
}

async function lockDealAndEnforceCapacity(
  tx: Prisma.TransactionClient,
  dealId: string
): Promise<{ max: number | null; redeemedCount: number; soldOut: boolean }> {
  const rows = await tx.$queryRaw<Array<{ id: string; maxRedemptions: number | null }>>`
    SELECT "id", "maxRedemptions"
    FROM "Deal"
    WHERE "id" = CAST(${dealId} AS uuid)
    FOR UPDATE
  `;

  if (!rows || rows.length === 0) {
    const err: any = new Error("Deal not found");
    err.status = 404;
    err.code = "DEAL_NOT_FOUND";
    throw err;
  }

  const max = rows[0].maxRedemptions;

  if (typeof max !== "number" || max <= 0) {
    return { max: max ?? null, redeemedCount: 0, soldOut: false };
  }

  const redeemedCount = await tx.redemption.count({
    where: { dealId, redeemedAt: { not: null } },
  });

  return { max, redeemedCount, soldOut: redeemedCount >= max };
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    if (!bodyText) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

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

    // Legacy JSON payload support
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
          return NextResponse.json(
            { ok: false, status: "EXPIRED", error: "This QR code has expired." },
            { status: 410 }
          );
        }
      }

      return await withTxnRetry(async () => {
        const result = await prisma.$transaction(async (tx) => {
          const { soldOut } = await lockDealAndEnforceCapacity(tx, legacy.dealId);
          if (soldOut) return { kind: "SOLD_OUT" as const };

          const shortCode = await generateUniqueRedemptionShortCode();

          const redemption = await tx.redemption.create({
            data: {
              dealId: legacy.dealId,
              code: scannedCode,
              shortCode,
              redeemedAt: new Date(),
              expiresAt: new Date(Date.now() + 15 * 60 * 1000),
              deviceHash: "legacy",
              activeKey: null,
            } as any,
            select: { id: true, redeemedAt: true },
          });

          return { kind: "REDEEMED" as const, redemption };
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

    // Normal flow (expiry + concurrency safe)
    return await withTxnRetry(async () => {
      const now = new Date();

      const out = await prisma.$transaction(async (tx) => {
        const redemption = await tx.redemption.findFirst({
          where: { OR: [{ shortCode: scannedCode }, { code: scannedCode }] },
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

        if (!redemption) return { kind: "NOT_FOUND" as const };

        // Expired?
        const exp = redemption.expiresAt ? new Date(redemption.expiresAt) : null;
        if (exp && !Number.isNaN(exp.getTime()) && exp <= now) {
          // important: clear activeKey so device can generate again
          await tx.redemption.update({
            where: { id: redemption.id },
            data: { activeKey: null },
          });
          return { kind: "EXPIRED" as const };
        }

        if (redemption.redeemedAt) {
          return { kind: "ALREADY_REDEEMED" as const, redeemedAt: redemption.redeemedAt };
        }

        const { soldOut } = await lockDealAndEnforceCapacity(tx, redemption.dealId);
        if (soldOut) return { kind: "SOLD_OUT" as const };

        // redeem only if still valid & not redeemed
        const updated = await tx.redemption.updateMany({
          where: { id: redemption.id, redeemedAt: null, expiresAt: { gt: now } },
          data: { redeemedAt: now, activeKey: null },
        });

        if (updated.count === 0) {
          const again = await tx.redemption.findUnique({
            where: { id: redemption.id },
            select: { redeemedAt: true, expiresAt: true },
          });

          if (again?.redeemedAt) return { kind: "ALREADY_REDEEMED" as const, redeemedAt: again.redeemedAt };

          const exp2 = again?.expiresAt ? new Date(again.expiresAt) : null;
          if (exp2 && exp2 <= now) {
            await tx.redemption.update({ where: { id: redemption.id }, data: { activeKey: null } });
            return { kind: "EXPIRED" as const };
          }

          return { kind: "CONFLICT" as const };
        }

        const redeemedRow = await tx.redemption.findUnique({
          where: { id: redemption.id },
          select: { id: true, redeemedAt: true },
        });

        return {
          kind: "REDEEMED" as const,
          deal: redemption.deal,
          merchant: redemption.deal.merchant,
          redemption: { id: redeemedRow!.id, redeemedAt: redeemedRow!.redeemedAt! },
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

      return NextResponse.json(
        {
          ok: true,
          status: "REDEEMED",
          message: "Redemption successful.",
          deal: { id: out.deal.id, title: out.deal.title },
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
