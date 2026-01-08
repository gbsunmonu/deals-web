// app/api/merchant/deals/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseRouteClient } from "@/lib/supabase-route";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DiscountType = "NONE" | "PERCENT";
type InventoryMode = "UNLIMITED" | "ONE" | "LIMITED";

type Body = {
  title: string;
  description: string;

  originalPrice?: number | null;

  discountValue?: number;
  discountType?: DiscountType;

  imageUrl?: string | null;

  startDate?: string; // "YYYY-MM-DD"
  endDate?: string; // "YYYY-MM-DD"
  startNow?: boolean;

  inventoryMode?: InventoryMode;
  maxRedemptions?: number | null;
};

function isValidYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function startOfDayUTC(dateYYYYMMDD: string) {
  return new Date(`${dateYYYYMMDD}T00:00:00.000Z`);
}

function endOfDayUTC(dateYYYYMMDD: string) {
  return new Date(`${dateYYYYMMDD}T23:59:59.999Z`);
}

function clampInt(n: any, fallback = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.trunc(x);
}

function makeShortCode(len = 6) {
  // crypto-safe
  return crypto.randomBytes(8).toString("base64url").replace(/[-_]/g, "").toUpperCase().slice(0, len);
}

async function generateUniqueDealShortCode() {
  for (let i = 0; i < 10; i++) {
    const code = makeShortCode(6);
    const exists = await prisma.deal.findUnique({
      where: { shortCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  return makeShortCode(8);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });

    // ✅ merchant lookup (no status gating until migration exists)
    const merchant = await prisma.merchant.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant profile not found for this user" },
        { status: 404 }
      );
    }

    const originalPrice =
      body.originalPrice === null || body.originalPrice === undefined
        ? null
        : clampInt(body.originalPrice, 0);

    const discountValue = clampInt(body.discountValue, 0);
    const discountType: DiscountType = discountValue > 0 ? "PERCENT" : "NONE";
    const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;

    const startNow = Boolean(body.startNow);

    let startsAt: Date;
    let endsAt: Date;

    if (startNow) {
      startsAt = new Date();
      if (!body.endDate || !isValidYYYYMMDD(body.endDate)) {
        return NextResponse.json(
          { error: "Valid endDate (YYYY-MM-DD) is required" },
          { status: 400 }
        );
      }
      endsAt = endOfDayUTC(body.endDate);
    } else {
      if (!body.startDate || !isValidYYYYMMDD(body.startDate)) {
        return NextResponse.json(
          { error: "Valid startDate (YYYY-MM-DD) is required" },
          { status: 400 }
        );
      }
      if (!body.endDate || !isValidYYYYMMDD(body.endDate)) {
        return NextResponse.json(
          { error: "Valid endDate (YYYY-MM-DD) is required" },
          { status: 400 }
        );
      }
      startsAt = startOfDayUTC(body.startDate);
      endsAt = endOfDayUTC(body.endDate);
    }

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
    }

    if (endsAt <= startsAt) {
      return NextResponse.json(
        { error: "endDate must be after startDate" },
        { status: 400 }
      );
    }

    const inventoryMode: InventoryMode = (body.inventoryMode ?? "UNLIMITED") as InventoryMode;

    let maxRedemptions: number | null = null;

    if (inventoryMode === "UNLIMITED") {
      maxRedemptions = null;
    } else if (inventoryMode === "ONE") {
      maxRedemptions = 1;
    } else {
      const m =
        body.maxRedemptions === null || body.maxRedemptions === undefined
          ? NaN
          : clampInt(body.maxRedemptions, NaN as any);

      if (!Number.isFinite(m) || m <= 0) {
        return NextResponse.json(
          { error: "For LIMITED inventory, maxRedemptions must be a number > 0" },
          { status: 400 }
        );
      }
      maxRedemptions = m;
    }

    const shortCode = await generateUniqueDealShortCode();

    const deal = await prisma.deal.create({
      data: {
        title,
        description,
        originalPrice: originalPrice ?? null,
        discountValue,
        discountType,
        imageUrl,
        maxRedemptions,
        startsAt,
        endsAt,
        shortCode,
        merchantId: merchant.id,
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        maxRedemptions: true,
        shortCode: true,
      },
    });

    return NextResponse.json({ ok: true, deal }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/merchant/deals/create] error:", err);
    return NextResponse.json(
      { error: "Failed to create deal", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
