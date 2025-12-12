// app/api/deals/[id]/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

// Next 16: params is a Promise<{ id: string }>
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await context.params;

    if (!dealId) {
      return NextResponse.json(
        { error: "Missing deal id" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const {
      title,
      description,
      originalPrice,
      discountValue,
      startsAt,
      endsAt,
      imageUrl,
      maxRedemptions,
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

    // ✅ Normalize description so it's NEVER null (Prisma requires String)
    const safeDescription: string =
      typeof description === "string" && description.trim().length > 0
        ? description
        : "";

    // ✅ Normalize numeric fields
    let numericOriginal: number | null = null;
    if (originalPrice !== undefined && originalPrice !== null && originalPrice !== "") {
      const n = Number(originalPrice);
      numericOriginal = Number.isNaN(n) ? null : n;
    }

    let numericDiscount: number = 0;
    if (discountValue !== undefined && discountValue !== null && discountValue !== "") {
      const n = Number(discountValue);
      numericDiscount = Number.isNaN(n) ? 0 : n;
    }

    let numericMaxRedemptions: number | null = null;
    if (maxRedemptions !== undefined && maxRedemptions !== null && maxRedemptions !== "") {
      const n = Number(maxRedemptions);
      numericMaxRedemptions = Number.isNaN(n) ? null : n;
    }

    // ✅ Auth: make sure current user owns this deal’s merchant
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

    const existingDeal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        merchant: true,
      },
    });

    if (!existingDeal) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    if (!existingDeal.merchant || existingDeal.merchant.userId !== user.id) {
      return NextResponse.json(
        { error: "You are not allowed to update this deal" },
        { status: 403 }
      );
    }

    // ✅ Perform update
    const updated = await prisma.deal.update({
      where: { id: dealId },
      data: {
        title,
        description: safeDescription,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        originalPrice: numericOriginal,
        discountValue: numericDiscount,
        imageUrl: imageUrl ?? existingDeal.imageUrl ?? null,
        // only include maxRedemptions if it exists in your schema
        ...(existingDeal as any).maxRedemptions !== undefined && {
          maxRedemptions: numericMaxRedemptions,
        },
      },
    });

    return NextResponse.json({ deal: updated }, { status: 200 });
  } catch (err) {
    console.error("[UPDATE DEAL] error:", err);
    return NextResponse.json(
      { error: "Failed to update deal" },
      { status: 500 }
    );
  }
}
