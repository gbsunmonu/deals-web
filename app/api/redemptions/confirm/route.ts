import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { Prisma } from "@prisma/client";

type LegacyDealQrPayload = {
  type: "DEAL";
  dealId: string;
  expiresAt?: string;
};

function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function extractCode(rawText: string): string | null {
  const t = String(rawText || "").trim();
  if (!t) return null;

  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts.length ? parts[parts.length - 1] : "";
      return last || null;
    } catch {}
  }

  return t;
}

async function clearActiveKeyIfAny(redemptionId: string) {
  try {
    await prisma.redemption.update({
      where: { id: redemptionId },
      data: { activeKey: null },
    });
  } catch {}
}

/**
 * ✅ Atomic redeem (no interactive tx)
 * ✅ Merchant-locked: Deal.merchantId must equal merchant.id
 */
async function redeemByCodeAtomic(scannedCode: string, merchantDbId: string) {
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
      merchant_id: string | null;
    }>
  >(Prisma.sql`
    WITH r AS (
      SELECT "id",
             "dealId"     AS deal_id,
             "redeemedAt" AS prior_redeemed_at,
             "expiresAt"  AS expires_at
      FROM "Redemption"
      WHERE "shortCode" = ${scannedCode}
         OR "code"      = ${scannedCode}
      LIMIT 1
    ),
    d AS (
      SELECT "id",
             "maxRedemptions" AS max_redemptions,
             "merchantId"     AS merchant_id
      FROM "Deal"
      WHERE "id" = (SELECT deal_id FROM r)
    ),
    rc AS (
      SELECT COUNT(*)::int AS redeemed_count
      FROM "Redemption"
      WHERE "dealId" = (SELECT deal_id FROM r)
        AND "redeemedAt" IS NOT NULL
    ),
    upd AS (
      UPDATE "Redemption"
      SET "redeemedAt" = NOW(),
          "activeKey"  = NULL
      WHERE "id" = (SELECT "id" FROM r)
        AND (SELECT prior_redeemed_at FROM r) IS NULL
        AND (
          (SELECT expires_at FROM r) IS NULL
          OR (SELECT expires_at FROM r) > NOW()
        )
        AND (
          (SELECT max_redemptions FROM d) IS NULL
          OR (SELECT max_redemptions FROM d) <= 0
          OR (SELECT redeemed_count FROM rc) < (SELECT max_redemptions FROM d)
        )
        AND (
          (SELECT merchant_id FROM d) = ${merchantDbId}::uuid
        )
      RETURNING "id" AS updated_id, "redeemedAt" AS updated_redeemed_at
    )
    SELECT
      (SELECT "id" FROM r)                  AS found_id,
      (SELECT deal_id FROM r)              AS deal_id,
      (SELECT prior_redeemed_at FROM r)    AS prior_redeemed_at,
      (SELECT expires_at FROM r)           AS expires_at,
      (SELECT max_redemptions FROM d)      AS max_redemptions,
      (SELECT redeemed_count FROM rc)      AS redeemed_count,
      (SELECT updated_id FROM upd)         AS updated_id,
      (SELECT updated_redeemed_at FROM upd) AS updated_redeemed_at,
      (SELECT merchant_id FROM d)          AS merchant_id
  `);

  const row = rows?.[0];

  if (!row || !row.found_id) return { kind: "NOT_FOUND" as const };
  if (!row.merchant_id) return { kind: "NOT_FOUND" as const };

  // merchant mismatch
  if (row.merchant_id !== merchantDbId) return { kind: "FORBIDDEN" as const };

  // expired
  if (row.expires_at && row.expires_at <= now) {
    await clearActiveKeyIfAny(row.found_id);
    return { kind: "EXPIRED" as const };
  }

  // already redeemed
  if (row.prior_redeemed_at) {
    return { kind: "ALREADY_REDEEMED" as const, redeemedAt: row.prior_redeemed_at };
  }

  // not updated => sold out or conflict
  if (!row.updated_id) {
    const max = row.max_redemptions;
    const redeemed = row.redeemed_count ?? 0;
    if (typeof max === "number" && max > 0 && redeemed >= max) return { kind: "SOLD_OUT" as const };
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
 * ✅ Legacy JSON payload flow (merchant-locked too)
 */
async function redeemLegacyPayloadAtomic(
  legacy: LegacyDealQrPayload,
  merchantDbId: string
) {
  const now = new Date();

  if (!legacy.dealId || !isUuid(legacy.dealId)) {
    return { kind: "BAD" as const, error: "Invalid deal id" };
  }

  // ensure deal belongs to merchant (Deal.merchantId === merchant.id)
  const owns = await prisma.deal.findFirst({
    where: { id: legacy.dealId, merchantId: merchantDbId },
    select: { id: true },
  });
  if (!owns) return { kind: "FORBIDDEN" as const };

  if (legacy.expiresAt) {
    const exp = new Date(legacy.expiresAt);
    if (Number.isNaN(exp.getTime()))
      return { kind: "BAD" as const, error: "QR expiry is invalid" };
    if (exp <= now) return { kind: "EXPIRED" as const };
  }

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

      return await redeemByCodeAtomic(shortCode, merchantDbId);
    } catch (e: any) {
      if (e?.code === "P2002") continue;
      throw e;
    }
  }

  return { kind: "CONFLICT" as const };
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Merchant auth required
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // ✅ map Supabase user -> Merchant record
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!merchant) {
      return NextResponse.json(
        { ok: false, error: "Not a merchant account" },
        { status: 403 }
      );
    }

    const merchantDbId = merchant.id;

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

      const out = await redeemLegacyPayloadAtomic(legacy, merchantDbId);

      if (out.kind === "FORBIDDEN") {
        return NextResponse.json(
          { ok: false, status: "FORBIDDEN", error: "You cannot redeem another merchant’s deal." },
          { status: 403 }
        );
      }
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
    const out = await redeemByCodeAtomic(scanned, merchantDbId);

    if (out.kind === "FORBIDDEN") {
      return NextResponse.json(
        { ok: false, status: "FORBIDDEN", error: "You cannot redeem another merchant’s deal." },
        { status: 403 }
      );
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
