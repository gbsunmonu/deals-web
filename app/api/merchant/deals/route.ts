// app/api/merchant/deals/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

type CreateDealPayload = {
  title: string;
  description: string;
  originalPrice: number | null;
  discountValue: number | null; // percent (0-100)
  startsAt: string; // "YYYY-MM-DD"
  endsAt: string; // "YYYY-MM-DD"
  imageUrl?: string | null;
};

const DEMO_MODE = process.env.DEMO_MODE === "true";
const DEMO_MERCHANT_ID = process.env.DEMO_MERCHANT_ID || "";

function toDateFromYmd(ymd: string) {
  // Force UTC midnight so it’s consistent across local/Vercel
  return new Date(`${ymd}T00:00:00.000Z`);
}

export async function POST(req: Request) {
  try {
    let merchantId: string | null = null;

    // -----------------------------
    // 1) Pick merchant (demo vs auth)
    // -----------------------------
    if (DEMO_MODE) {
      if (!DEMO_MERCHANT_ID) {
        return NextResponse.json(
          { error: "DEMO_MODE is true but DEMO_MERCHANT_ID is missing." },
          { status: 500 }
        );
      }

      const demoMerchant = await prisma.merchant.findUnique({
        where: { id: DEMO_MERCHANT_ID },
        select: { id: true },
      });

      if (!demoMerchant) {
        return NextResponse.json(
          {
            error:
              "Demo merchant not found. Make sure DEMO_MERCHANT_ID exists in the Merchant table.",
          },
          { status: 500 }
        );
      }

      merchantId = demoMerchant.id;
    } else {
      const supabase = createSupabaseServer();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) console.error("[Create deal] auth error:", authError);

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const merchant = await prisma.merchant.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!merchant) {
        return NextResponse.json(
          {
            error:
              "Merchant profile not found. Please complete your profile first.",
          },
          { status: 400 }
        );
      }

      merchantId = merchant.id;
    }

    if (!merchantId) {
      return NextResponse.json(
        { error: "No merchant available." },
        { status: 500 }
      );
    }

    // -----------------------------
    // 2) Read + validate body
    // -----------------------------
    const body = (await req.json()) as CreateDealPayload;

    const title = (body.title || "").trim();
    const description = (body.description || "").trim();

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    // Prisma schema: description is required String
    const safeDescription = description || " ";

    // originalPrice is Int? in Prisma schema
    let originalPrice: number | null = null;
    if (body.originalPrice != null) {
      const n = Number(body.originalPrice);
      if (!Number.isNaN(n) && n > 0) originalPrice = Math.round(n);
    }

    // discountValue is Int (percent 0-100)
    let discountValue = 0;
    if (body.discountValue != null) {
      const n = Number(body.discountValue);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) discountValue = Math.round(n);
    }

    if (!body.startsAt || !body.endsAt) {
      return NextResponse.json(
        { error: "Both start date and end date are required." },
        { status: 400 }
      );
    }

    const startsAt = toDateFromYmd(body.startsAt);
    const endsAt = toDateFromYmd(body.endsAt);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json(
        { error: "Invalid start or end date." },
        { status: 400 }
      );
    }

    const imageUrl = body.imageUrl?.trim() || null;

    // Prisma schema has discountType enum: NONE | PERCENT
    const discountType = discountValue > 0 ? "PERCENT" : "NONE";

    // -----------------------------
    // 3) Create deal
    // -----------------------------
    const deal = await prisma.deal.create({
      data: {
        title,
        description: safeDescription,
        originalPrice: originalPrice ?? undefined,
        discountValue,
        discountType,
        imageUrl,
        startsAt,
        endsAt,
        merchantId,
      },
    });

    return NextResponse.json({ deal }, { status: 201 });
  } catch (err) {
    console.error("[Create deal route] unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to create deal.", detail: String(err) },
      { status: 500 }
    );
  }
}
