import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type LegacyDealQrPayload = {
  type: "DEAL";
  dealId: string;
  expiresAt?: string;
};

function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function extractCode(rawText: string): string | null {
  const t = String(rawText || "").trim();
  if (!t) return null;

  // If URL, use last path segment
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts.length ? parts[parts.length - 1] : "";
      return last || null;
    } catch {
      // fallthrough
    }
  }

  return t;
}

async function clearActiveKeyIfAny(redemptionId: string) {
  try {
    await prisma.redemption.update({
      where: { id: redemptionId },
      data: { activeKey: null },
    });
  } catch {
    // ignore
  }
}

/**
 * ✅ Atomic redeem by shortCode/code in ONE SQL call (no interactive transaction).
 * - Checks expiresAt
 * - Checks already redeemed
 * - Enforces maxRedemptions safely
 * - Updates redeemedAt + clears activeKey
 */
async function redeemByCodeAtomic(scannedCode: string) {
  const now = new Date();

  const rows = await prisma.$queryRaw<
    Array<{
      found_id: string | null;
      deal_id: string | null;
      prior_redeemed_at: Date | null;
      expires_at: Date | null;
      max_redemptions: number | null;
      redeemed_count: number | null;
      updated_id: string | null;
      updated_redeemed_at: Date | null;
      active_key: string | null;
    }>
  >`
    WITH r AS (
      SELECT "id",
             "dealId" as deal_id,
             "redeemedAt" as prior_redeemed_at,
             "expiresAt" as expires_at,
             "activeKey" as active_key
      FROM "Redemption"
      WHERE "shortCode" = ${scannedCode} OR "code" = ${scannedCode}
      LIMIT 1
    ),
    d AS (
      SELECT "id", "maxRedemptions" as max_redemptions
      FROM "Deal"
      WHERE "id" = (SELECT deal_id FROM r)
    ),
    rc AS (
      SELECT COUNT(*)::int as redeemed_count
      FROM "Redemption"
      WHERE "dealId" = (SELECT deal_id FROM r)
        AND "redeemedAt" IS NOT NULL
    ),
    upd AS (
      UPDATE "Redemption"
      SET "redeemedAt" = NOW(),
          "activeKey" = NULL
      WHERE "id" = (SELECT "id" FROM r)
        AND (SELECT prior_redeemed_at FROM r) IS NULL
        AND (
          (SELECT expires_at FROM r) IS NULL OR (SELECT expires_at FROM r) > NOW()
        )
        AND (
          (SELECT max_redemptions FROM d) IS NULL
          OR (SELECT max_redemptions FROM d) <= 0
          OR (SELECT redeemed_count FROM rc) < (SELECT max_redemptions FROM d)
        )
      RETURNING "id" as updated_id, "redeemedAt" as updated_redeemed_at
    )
    SELECT
      (SELECT "id" FROM r) as found_id,
      (SELECT deal_id FROM r) as deal_id,
      (SELECT prior_redeemed_at FROM r) as prior_redeemed_at,
      (SELECT expires_at FROM r) as expires_at,
      (SELECT max_redemptions FROM d) as max_redemptions,
      (SELECT redeemed_count FROM rc) as redeemed_count,
      (SELECT updated_id FROM upd) as updated_id,
      (SELECT updated_redeemed_at FROM upd) as updated_redeemed_at,
      (SELECT active_key FROM r) as active_key
  `;

  const row = rows?.[0];

  if (!row || !row.found_id) {
    return { kind: "NOT_FOUND" as const };
  }

  // Expired?
  if (row.expires_at && row.expires_at <= now) {
    // unlock device reuse
    await clearActiveKeyIfAny(row.found_id);
    return { kind: "EXPIRED" as const };
  }

  // Already redeemed?
  if (row.prior_redeemed_at) {
    return { kind: "ALREADY_REDEEMED" as const, redeemedAt: row.prior_redeemed_at };
  }

  // Not updated => sold out OR conflict
  if (!row.updated_id) {
    const max = row.max_redemptions;
    const redeemed = row.redeemed_count ?? 0;

    if (typeof max === "number" && max > 0 && redeemed >= max) {
      return { kind: "SOLD_OUT" as const };
    }
    return { kind: "CONFLICT" as const };
  }

  return {
    kind: "REDEEMED" as const,
    redemptionId: row.updated_id,
    redeemedAt: row.updated_redeemed_at!,
    dealId: row.deal_id!,
  };
}

/**
 * ✅ Legacy JSON payload flow:
 * Instead of creating a Redemption inside an interactive transaction,
 * we create a normal Redemption code (shortCode) and redeem via atomic flow above.
 *
 * This keeps legacy working but avoids Vercel 5s interactive tx timeout.
 */
async function redeemLegacyPayloadAtomic(legacy: LegacyDealQrPayload) {
  const now = new Date();

  if (!legacy.dealId || !isUuid(legacy.dealId)) {
    return { kind: "BAD" as const, error: "Invalid deal id" };
  }

  if (legacy.expiresAt) {
    const exp = new Date(legacy.expiresAt);
    if (Number.isNaN(exp.getTime())) {
      return { kind: "BAD" as const, error: "QR expiry is invalid" };
    }
    if (exp <= now) {
      return { kind: "EXPIRED" as const };
    }
  }

  // Create a one-time shortCode redemption record quickly (no transaction)
  // Then redeem it using atomic redeem logic to enforce capacity + expiry.
  // If shortCode collision happens (rare), retry a few times.
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = attempt < 4 ? makeShortCode(6) : makeShortCode(8);
    try {
      await prisma.redemption.create({
        data: {
          dealId: legacy.dealId,
          shortCode,
          code: shortCode,
          redeemedAt: null,
          createdAt: now,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          deviceHash: "legacy",
          activeKey: null,
        } as any,
        select: { id: true },
      });

      // Now redeem it (same rules as normal flow)
      const out = await redeemByCodeAtomic(shortCode);
      return out;
    } catch (e: any) {
      // Prisma unique violation = try again
      if (e?.code === "P2002") continue;
      throw e;
    }
  }

  return { kind: "CONFLICT" as const };
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

    const scanned = extractCode(rawText);
    if (!scanned) {
      return NextResponse.json({ error: "QR code is empty" }, { status: 400 });
    }

    // Legacy JSON
    if (scanned.startsWith("{") && scanned.endsWith("}")) {
      let legacy: LegacyDealQrPayload;
      try {
        legacy = JSON.parse(scanned);
      } catch {
        return NextResponse.json({ error: "QR code is not a valid deal code" }, { status: 400 });
      }

      if (legacy.type !== "DEAL" || !legacy.dealId) {
        return NextResponse.json({ error: "QR code is not a valid deal code" }, { status: 400 });
      }

      const out = await redeemLegacyPayloadAtomic(legacy);

      if (out.kind === "BAD") {
        return NextResponse.json({ ok: false, status: "BAD_QR", error: out.error }, { status: 400 });
      }
      if (out.kind === "NOT_FOUND") {
        return NextResponse.json({ error: "Redemption code not found" }, { status: 404 });
      }
      if (out.kind === "EXPIRED") {
        return NextResponse.json({ ok: false, status: "EXPIRED", error: "This QR code has expired." }, { status: 410 });
      }
      if (out.kind === "ALREADY_REDEEMED") {
        return NextResponse.json(
          { ok: false, status: "ALREADY_REDEEMED", error: "This QR code has already been redeemed.", redeemedAt: out.redeemedAt },
          { status: 409 }
        );
      }
      if (out.kind === "SOLD_OUT") {
        return NextResponse.json({ ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." }, { status: 409 });
      }
      if (out.kind === "CONFLICT") {
        return NextResponse.json({ ok: false, status: "CONFLICT", error: "Could not redeem. Please try again." }, { status: 409 });
      }

      // REDEEMED
      return NextResponse.json(
        {
          ok: true,
          status: "REDEEMED",
          message: "Redemption successful.",
          redemption: { id: out.redemptionId, redeemedAt: out.redeemedAt },
        },
        { status: 200 }
      );
    }

    // Normal (shortCode / URL)
    const out = await redeemByCodeAtomic(scanned);

    if (out.kind === "NOT_FOUND") {
      return NextResponse.json({ error: "Redemption code not found" }, { status: 404 });
    }
    if (out.kind === "EXPIRED") {
      return NextResponse.json({ ok: false, status: "EXPIRED", error: "This QR code has expired." }, { status: 410 });
    }
    if (out.kind === "ALREADY_REDEEMED") {
      return NextResponse.json(
        { ok: false, status: "ALREADY_REDEEMED", error: "This QR code has already been redeemed.", redeemedAt: out.redeemedAt },
        { status: 409 }
      );
    }
    if (out.kind === "SOLD_OUT") {
      return NextResponse.json({ ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." }, { status: 409 });
    }
    if (out.kind === "CONFLICT") {
      return NextResponse.json({ ok: false, status: "CONFLICT", error: "Could not redeem. Please try again." }, { status: 409 });
    }

    // Success: include a tiny bit of info (optional)
    return NextResponse.json(
      {
        ok: true,
        status: "REDEEMED",
        message: "Redemption successful.",
        redemption: { id: out.redemptionId, redeemedAt: out.redeemedAt },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Unexpected error in /api/redemptions/confirm:", err);
    return NextResponse.json(
      { error: "Unexpected error confirming redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
