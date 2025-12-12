// app/api/merchant/deals/create/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      title,
      description,
      originalPrice,
      discountValue,
      startsAt,
      endsAt,
      imageUrl,
    } = body;

    // ✅ Basic validation
    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!startsAt || !endsAt) {
      return NextResponse.json(
        { error: "Start and end dates are required" },
        { status: 400 }
      );
    }

    // ✅ Auth: merchant must be logged in
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Find merchant matched to this Supabase user
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: "No merchant profile found for this user" },
        { status: 400 }
      );
    }

    // ✅ Make sure description is never null
    const safeDescription: string =
      typeof description === "string" && description.trim().length > 0
        ? description
        : "";

    // ✅ Normalise price/discount
    let numericOriginal: number | null = null;
    if (originalPrice !== undefined && originalPrice !== null && originalPrice !== "") {
      const n = Number(originalPrice);
      numericOriginal = Number.isNaN(n) ? null : n;
    }

    let numericDiscount = 0;
    if (discountValue !== undefined && discountValue !== null && discountValue !== "") {
      const n = Number(discountValue);
      numericDiscount = Number.isNaN(n) ? 0 : n;
    }

    // ✅ Create deal using ONLY fields from your Prisma model
    const deal = await prisma.deal.create({
      data: {
        title,
        description: safeDescription,
        originalPrice: numericOriginal,
        discountValue: numericDiscount,
        // discountType defaults to NONE
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        imageUrl: imageUrl?.trim() || null,
        merchantId: merchant.id,
      },
    });

    return NextResponse.json({ deal }, { status: 201 });
  } catch (err) {
    console.error("[MERCHANT DEAL CREATE] error:", err);
    return NextResponse.json(
      { error: "Failed to create deal" },
      { status: 500 }
    );
  }
}
