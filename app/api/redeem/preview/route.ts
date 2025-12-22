// app/api/redeem/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function clampCode(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isCodeLike(s: string) {
  return /^[A-Z0-9]{4,12}$/.test(s);
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Merchant auth
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id as any },
      select: { id: true, name: true },
    });

    if (!merchant) {
      return NextResponse.json({ ok: false, error: "not_a_merchant" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const shortCode = clampCode(body?.shortCode);

    if (!shortCode || !isCodeLike(shortCode)) {
      return NextResponse.json(
        { ok: false, error: "invalid_code", message: "Invalid short code." },
        { status: 400 }
      );
    }

    const now = new Date();

    // ✅ Load redemption + deal
    const redemption = await prisma.redemption.findUnique({
      where: { shortCode },
      select: {
        id: true,
        shortCode: true,
        redeemedAt: true,
        expiresAt: true,
        deal: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            maxRedemptions: true,
            discountType: true,
            discountValue: true,
            originalPrice: true,
            merchantId: true,
            merchant: { select: { name: true } },
          },
        },
      },
    });

    if (!redemption) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: "QR code not found." },
        { status: 404 }
      );
    }

    // ✅ Merchant ownership
    if (redemption.deal.merchantId !== merchant.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "wrong_merchant",
          message: "This QR is not for your store.",
          deal: { id: redemption.deal.id, title: redemption.deal.title, merchantName: redemption.deal.merchant.name },
        },
        { status: 403 }
      );
    }

    const dealStarts = new Date(redemption.deal.startsAt);
    const dealEnds = new Date(redemption.deal.endsAt);

    const expiresAt = redemption.expiresAt ? new Date(redemption.expiresAt) : null;
    const redeemedAt = redemption.redeemedAt ? new Date(redemption.redeemedAt) : null;

    // ✅ Build state
    let state:
      | "READY"
      | "DEAL_NOT_STARTED"
      | "DEAL_ENDED"
      | "QR_EXPIRED"
      | "ALREADY_REDEEMED"
      | "SOLD_OUT" = "READY";

    if (now < dealStarts) state = "DEAL_NOT_STARTED";
    else if (now > dealEnds) state = "DEAL_ENDED";
    else if (!expiresAt || now >= expiresAt) state = "QR_EXPIRED";
    else if (redeemedAt) state = "ALREADY_REDEEMED";

    // ✅ Optional inventory enforcement (Option A: check at redeem time)
    if (state === "READY" && redemption.deal.maxRedemptions && redemption.deal.maxRedemptions > 0) {
      const redeemedCount = await prisma.redemption.count({
        where: { dealId: redemption.deal.id, redeemedAt: { not: null } },
      });
      if (redeemedCount >= redemption.deal.maxRedemptions) state = "SOLD_OUT";
    }

    const canRedeem = state === "READY";

    return NextResponse.json({
      ok: true,
      state,
      canRedeem,
      now: now.toISOString(),
      shortCode: redemption.shortCode,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      redeemedAt: redeemedAt ? redeemedAt.toISOString() : null,
      deal: {
        id: redemption.deal.id,
        title: redemption.deal.title,
        merchantName: redemption.deal.merchant.name,
        startsAt: dealStarts.toISOString(),
        endsAt: dealEnds.toISOString(),
        discountType: String(redemption.deal.discountType),
        discountValue: Number(redemption.deal.discountValue ?? 0),
        originalPrice: redemption.deal.originalPrice ?? null,
        maxRedemptions: redemption.deal.maxRedemptions ?? null,
      },
      merchant: { id: merchant.id, name: merchant.name },
    });
  } catch (e: any) {
    console.error("redeem/preview error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
