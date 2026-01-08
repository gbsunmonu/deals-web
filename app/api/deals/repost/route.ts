import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const dealId = String(body?.dealId || "").trim();
    if (!dealId) {
      return NextResponse.json({ ok: false, error: "missing_dealId" }, { status: 400 });
    }

    // resolve merchant for this user
    const merchant = await prisma.merchant.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!merchant) {
      return NextResponse.json({ ok: false, error: "merchant_not_found" }, { status: 404 });
    }

    // fetch deal (must belong to merchant)
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, merchantId: merchant.id },
    });

    if (!deal) {
      return NextResponse.json({ ok: false, error: "deal_not_found" }, { status: 404 });
    }

    const now = new Date();
    const expired = new Date(deal.endsAt) < now;

    // We only allow repost if expired (you can relax this if you want)
    if (!expired) {
      return NextResponse.json({ ok: false, error: "deal_not_expired" }, { status: 400 });
    }

    // Create a new deal copied from old one
    // Default: repost is 7 days from now (edit if you want)
    const startsAt = now;
    const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const newDeal = await prisma.deal.create({
      data: {
        merchantId: merchant.id,
        title: deal.title,
        description: deal.description,
        originalPrice: deal.originalPrice,
        discountValue: deal.discountValue as any,
        discountType: deal.discountType,
        imageUrl: deal.imageUrl,
        maxRedemptions: deal.maxRedemptions,
        startsAt,
        endsAt,

        repostedFromId: deal.id,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, newDealId: newDeal.id }, { status: 200 });
  } catch (e: any) {
    console.error("repost error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
