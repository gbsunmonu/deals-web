// app/api/merchant/deals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CreateDealPayload = {
  title: string;
  description: string;
  originalPrice?: number | null;

  discountValue?: number | null;
  discountPercent?: number | null;

  imageUrl?: string | null;

  startDate?: string;
  endDate: string;

  maxRedemptions?: number | null;
};

function toIntOrNull(v: any) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function dateAt1159(dateStr: string) {
  return new Date(`${dateStr}T11:59:00.000Z`);
}

function todayIsoDateUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = data.user;

    const body = (await req.json().catch(() => ({}))) as Partial<CreateDealPayload>;

    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    if (!title || !description) {
      return NextResponse.json(
        { error: "title and description are required" },
        { status: 400 }
      );
    }

    const originalPrice = toIntOrNull(body.originalPrice);

    const rawDiscount =
      toIntOrNull(body.discountValue) ?? toIntOrNull(body.discountPercent) ?? 0;
    const discountValue = clamp(rawDiscount, 0, 100);
    const discountType = discountValue > 0 ? "PERCENT" : "NONE";

    const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;

    const startDate = (body.startDate && String(body.startDate).trim()) || todayIsoDateUTC();
    const endDate = String(body.endDate ?? "").trim();
    if (!endDate) {
      return NextResponse.json({ error: "endDate is required" }, { status: 400 });
    }

    const startsAt = dateAt1159(startDate);
    const endsAt = dateAt1159(endDate);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "Invalid start/end date" }, { status: 400 });
    }

    if (endsAt < startsAt) {
      return NextResponse.json(
        { error: "endDate must be on/after startDate" },
        { status: 400 }
      );
    }

    const maxRedemptionsRaw = toIntOrNull(body.maxRedemptions);
    const maxRedemptions =
      maxRedemptionsRaw == null ? null : Math.max(1, maxRedemptionsRaw);

    // ✅ merchant lookup (no status gating until migration exists)
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant profile not found for this user" },
        { status: 404 }
      );
    }

    const deal = await prisma.deal.create({
      data: {
        merchantId: merchant.id,
        title,
        description,
        originalPrice,
        discountValue,
        discountType: discountType as any,
        imageUrl,
        startsAt,
        endsAt,
        maxRedemptions,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: deal.id }, { status: 201 });
  } catch (err: any) {
    console.error("[/api/merchant/deals] error:", err);
    return NextResponse.json(
      { error: "Failed to create deal", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
