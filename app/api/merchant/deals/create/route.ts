import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Parse YYYY-MM-DD safely
function parseYMD(ymd: string) {
  if (typeof ymd !== "string") return null;
  const s = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const [y, m, d] = s.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;

  // Use UTC to avoid timezone shifting dates
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;

  // Validate it didn’t roll (e.g. 2025-02-31)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
    return null;

  return dt;
}

// Set a UTC time on a UTC date
function withUtcTime(dateOnlyUtc: Date, hours: number, minutes: number) {
  return new Date(Date.UTC(
    dateOnlyUtc.getUTCFullYear(),
    dateOnlyUtc.getUTCMonth(),
    dateOnlyUtc.getUTCDate(),
    hours,
    minutes,
    0,
    0
  ));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const title = String(body?.title ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const imageUrl = body?.imageUrl ? String(body.imageUrl).trim() : null;

    // match your schema
    const originalPrice =
      body?.originalPrice === null || body?.originalPrice === undefined || body?.originalPrice === ""
        ? null
        : Number(body.originalPrice);

    const discountValue =
      body?.discountValue === null || body?.discountValue === undefined || body?.discountValue === ""
        ? 0
        : Number(body.discountValue);

    const maxRedemptions =
      body?.maxRedemptions === null || body?.maxRedemptions === undefined || body?.maxRedemptions === ""
        ? null
        : Number(body.maxRedemptions);

    // ✅ required: endDate only (YYYY-MM-DD)
    const endDateStr = String(body?.endDate ?? "").trim();
    const endDateOnlyUtc = parseYMD(endDateStr);
    if (!endDateOnlyUtc) {
      return NextResponse.json(
        { error: "Valid endDate (YYYY-MM-DD) is required" },
        { status: 400 }
      );
    }

    // ✅ starts = today, ends = endDate, both at 11:59 (UTC)
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startsAt = withUtcTime(todayUtc, 11, 59);
    const endsAt = withUtcTime(endDateOnlyUtc, 11, 59);

    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "description is required" }, { status: 400 });

    if (originalPrice !== null && (!Number.isFinite(originalPrice) || originalPrice < 0)) {
      return NextResponse.json({ error: "originalPrice must be a valid number" }, { status: 400 });
    }
    if (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > 100) {
      return NextResponse.json({ error: "discountValue must be 0-100" }, { status: 400 });
    }
    if (maxRedemptions !== null && (!Number.isFinite(maxRedemptions) || maxRedemptions <= 0)) {
      return NextResponse.json({ error: "maxRedemptions must be a positive number or null" }, { status: 400 });
    }
    if (endsAt <= startsAt) {
      return NextResponse.json({ error: "endDate must be after today" }, { status: 400 });
    }

    // Find merchant linked to user
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!merchant) {
      return NextResponse.json({ error: "Merchant profile not found" }, { status: 404 });
    }

    const deal = await prisma.deal.create({
      data: {
        title,
        description,
        originalPrice,
        discountValue,
        discountType: discountValue > 0 ? "PERCENT" : "NONE",
        imageUrl: imageUrl || null,
        maxRedemptions,
        startsAt,
        endsAt,
        merchantId: merchant.id,
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        maxRedemptions: true,
      },
    });

    return NextResponse.json({ ok: true, deal }, { status: 201 });
  } catch (err: any) {
    console.error("[/api/merchant/deals/create] error:", err);
    return NextResponse.json(
      { error: "Failed to create deal", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
