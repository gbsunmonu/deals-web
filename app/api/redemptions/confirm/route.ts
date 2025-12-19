// app/api/redemptions/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

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
 * ✅ Atomic redeem by shortCode/code (ONE SQL call)
 * ✅ Merchant-only enforcement: only allows redeem if deal belongs to merchantId
 */
async function redeemByCodeAtomic(scannedCode: string, merchantId: string) {
  const now = new Date();

  const rows = await prisma.$queryRaw<
    Array<{
      found_id: string | null;
      deal_id: string | null;
      prior_redeemed_at: Date | null;
      expires_at: Date | null;
      deal_max_redemptions: number | null;
      redeemed_count: number | null;
      updated_id: string | null;
      updated_redeemed_at: Date | null;
      active_key: string | null;
    }>
  >`
    WITH r AS (
      SELECT
        r."id"                                  AS found_id,
        r."dealId"                              AS deal_id,
        r."redeemedAt"                          AS prior_redeemed_at,
        r."expiresAt"                           AS expires_at,
        r."activeKey"                           AS active_key,
        d."maxRedemptions"                      AS deal_max_redemptions
      FROM "Redemption" r
      JOIN "Deal" d
        ON d."id" = r."dealId"
      WHERE (r."shortCode" = ${scannedCode} OR r."code" = ${scannedCode})
        AND d."merchantId" = CAST(${merchantId} AS uuid)
      LIMIT 1
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
          "activeKey" = NULL
      WHERE "id" = (SELECT found_id FROM r)
        AND (SELECT prior_redeemed_at FROM r) IS NULL
        AND (
          (SELECT expires_at FROM r) IS NULL OR (SELECT expires_at FROM r) > NOW()
        )
        AND (
          (SELECT deal_max_redemptions FROM r) IS NULL
          OR (SELECT deal_max_redemptions FROM r) <= 0
          OR (SELECT redeemed_count FROM rc) < (SELECT deal_max_redemptions FROM r)
        )
      RETURNING "id" AS updated_id, "redeemedAt" AS updated_redeemed_at
    )
    SELECT
      (SELECT found_id FROM r)                AS found_id,
      (SELECT deal_id FROM r)                 AS deal_id,
      (SELECT prior_redeemed_at FROM r)       AS prior_redeemed_at,
      (SELECT expires_at FROM r)              AS expires_at,
      (SELECT deal_max_redemptions FROM r)    AS deal_max_redemptions,
      (SELECT redeemed_count FROM rc)         AS redeemed_count,
      (SELECT updated_id FROM upd)            AS updated_id,
      (SELECT updated_redeemed_at FROM upd)   AS updated_redeemed_at,
      (SELECT active_key FROM r)              AS active_key
  `;

  const row = rows?.[0];

  if (!row || !row.found_id) {
    // ✅ includes “wrong merchant” as NOT_FOUND (secure + no info leakage)
    return { kind: "NOT_FOUND" as const };
  }

  // Expired?
  if (row.expires_at && row.expires_at <= now) {
    await clearActiveKeyIfAny(row.found_id);
    return { kind: "EXPIRED" as const };
  }

  // Already redeemed?
  if (row.prior_redeemed_at) {
    return { kind: "ALREADY_REDEEMED" as const, redeemedAt: row.prior_redeemed_at };
  }

  // Not updated => sold out OR conflict
  if (!row.updated_id) {
    const max = row.deal_max_redemptions;
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
 * ✅ Legacy payload:
 * - First verify the deal belongs to this merchant
 * - Create a temporary redemption
 * - Redeem via atomic flow (same enforcement + capacity)
 */
async function redeemLegacyPayloadAtomic(legacy: LegacyDealQrPayload, merchantId: string) {
  const now = new Date();

  if (!legacy.dealId || !isUuid(legacy.dealId)) {
    return { kind: "BAD" as const, error: "Invalid deal id" };
  }

  if (legacy.expiresAt) {
    const exp = new Date(legacy.expiresAt);
    if (Number.isNaN(exp.getTime())) return { kind: "BAD" as const, error: "QR expiry is invalid" };
    if (exp <= now) return { kind: "EXPIRED" as const };
  }

  // ✅ merchant-only gate (legacy path)
  const deal = await prisma.deal.findUnique({
    where: { id: legacy.dealId },
    select: { merchantId: true },
  });
  if (!deal || deal.merchantId !== merchantId) {
    return { kind: "NOT_FOUND" as const };
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

      return await redeemByCodeAtomic(shortCode, merchantId);
    } catch (e: any) {
      if (e?.code === "P2002") continue; // shortCode collision
      throw e;
    }
  }

  return { kind: "CONFLICT" as const };
}

export async function POST(req: NextRequest) {
  try {
    // ✅ merchant auth required
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!merchant) {
      return NextResponse.json({ ok: false, error: "Not a merchant" }, { status: 403 });
    }

    const bodyText = await req.text();
    if (!bodyText) return NextResponse.json({ error: "Missing request body" }, { status: 400 });

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
    if (!scanned) return NextResponse.json({ error: "QR code is empty" }, { status: 400 });

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

      const out = await redeemLegacyPayloadAtomic(legacy, merchant.id);

      if (out.kind === "BAD") return NextResponse.json({ ok: false, status: "BAD_QR", error: out.error }, { status: 400 });
      if (out.kind === "NOT_FOUND") return NextResponse.json({ error: "Redemption code not found" }, { status: 404 });
      if (out.kind === "EXPIRED") return NextResponse.json({ ok: false, status: "EXPIRED", error: "This QR code has expired." }, { status: 410 });
      if (out.kind === "ALREADY_REDEEMED")
        return NextResponse.json({ ok: false, status: "ALREADY_REDEEMED", error: "This QR code has already been redeemed.", redeemedAt: out.redeemedAt }, { status: 409 });
      if (out.kind === "SOLD_OUT") return NextResponse.json({ ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." }, { status: 409 });
      if (out.kind === "CONFLICT") return NextResponse.json({ ok: false, status: "CONFLICT", error: "Could not redeem. Please try again." }, { status: 409 });

      return NextResponse.json(
        { ok: true, status: "REDEEMED", message: "Redemption successful.", redemption: { id: out.redemptionId, redeemedAt: out.redeemedAt } },
        { status: 200 }
      );
    }

    // Normal (shortCode / URL)
    const out = await redeemByCodeAtomic(scanned, merchant.id);

    if (out.kind === "NOT_FOUND") return NextResponse.json({ error: "Redemption code not found" }, { status: 404 });
    if (out.kind === "EXPIRED") return NextResponse.json({ ok: false, status: "EXPIRED", error: "This QR code has expired." }, { status: 410 });
    if (out.kind === "ALREADY_REDEEMED")
      return NextResponse.json({ ok: false, status: "ALREADY_REDEEMED", error: "This QR code has already been redeemed.", redeemedAt: out.redeemedAt }, { status: 409 });
    if (out.kind === "SOLD_OUT") return NextResponse.json({ ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." }, { status: 409 });
    if (out.kind === "CONFLICT") return NextResponse.json({ ok: false, status: "CONFLICT", error: "Could not redeem. Please try again." }, { status: 409 });

    return NextResponse.json(
      { ok: true, status: "REDEEMED", message: "Redemption successful.", redemption: { id: out.redemptionId, redeemedAt: out.redeemedAt } },
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
