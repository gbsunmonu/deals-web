// app/api/merchant/deals/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

type CreateDealPayload = {
  title: string;
  description: string;
  originalPrice: number | null;
  discountValue: number | null;
  startsAt: string; // "YYYY-MM-DD"
  endsAt: string;   // "YYYY-MM-DD"
  imageUrl?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServer();

    // 1) Auth – merchant must be logged in
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[Create deal] auth error:", authError);
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Find merchant for this user
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant profile not found. Please complete your profile first." },
        { status: 400 }
      );
    }

    // 3) Read JSON body from your NewDealPage
    const body = (await req.json()) as CreateDealPayload;

    const title = (body.title || "").trim();
    const description = (body.description || "").trim();

    if (!title) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 }
      );
    }

    // 4) Coerce numbers safely
    let originalPrice: number | null = null;
    if (body.originalPrice != null) {
      const n = Number(body.originalPrice);
      if (!Number.isNaN(n) && n > 0) {
        originalPrice = n;
      }
    }

    let discountValue = 0; // Prisma needs non-null
    if (body.discountValue != null) {
      const n = Number(body.discountValue);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) {
        discountValue = n;
      }
    }

    // 5) Handle dates (no time fields → assume full day)
    if (!body.startsAt || !body.endsAt) {
      return NextResponse.json(
        { error: "Both start date and end date are required." },
        { status: 400 }
      );
    }

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json(
        { error: "Invalid start or end date." },
        { status: 400 }
      );
    }

    // 6) Image URL (already uploaded from the browser via Supabase)
    const imageUrl = body.imageUrl || null;

    // 7) Build Prisma data
    const data: any = {
      title,
      description,
      startsAt,
      endsAt,
      discountValue, // ALWAYS a number (0–100)
      merchant: {
        connect: { id: merchant.id }, // use relation, not merchantId directly
      },
    };

    if (originalPrice != null) {
      data.originalPrice = originalPrice;
    }
    if (imageUrl) {
      data.imageUrl = imageUrl;
    }

    console.log("[Create deal] creating with data:", data);

    const deal = await prisma.deal.create({ data });

    console.log("[Create deal] success:", {
      id: deal.id,
      title: deal.title,
      discountValue: deal.discountValue,
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
