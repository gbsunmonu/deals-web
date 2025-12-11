// app/api/deals/create/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DiscountType } from "@prisma/client";

/**
 * POST /api/deals/create
 * Alternate creation endpoint, same discount logic as /api/deals
 *
 * Body:
 * {
 *   title: string;
 *   description: string;
 *   originalPrice: number | null;
 *   discountValue: number;          // percentage (0–100)
 *   startsAt: string;               // ISO
 *   endsAt: string;                 // ISO
 *   imageUrl?: string | null;
 *   merchantId: string;             // required
 * }
 */
export async function POST(req: Request) {
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
      merchantId,
    } = body as {
      title: string;
      description: string;
      originalPrice: number | null;
      discountValue: number;
      startsAt: string;
      endsAt: string;
      imageUrl?: string | null;
      merchantId: string;
    };

    if (!title || !merchantId) {
      return NextResponse.json(
        { error: "title and merchantId are required" },
        { status: 400 },
      );
    }

    const parsedOriginalPrice =
      originalPrice !== null && !Number.isNaN(Number(originalPrice))
        ? Number(originalPrice)
        : null;

    const parsedDiscount =
      discountValue && !Number.isNaN(Number(discountValue))
        ? Number(discountValue)
        : 0;

    const discountType: DiscountType =
      parsedDiscount > 0 ? DiscountType.PERCENT : DiscountType.NONE;

    const deal = await prisma.deal.create({
      data: {
        title: title.trim(),
        description: description?.trim() ?? "",
        originalPrice: parsedOriginalPrice,
        discountValue: parsedDiscount,
        discountType,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        imageUrl: imageUrl?.trim() || null,
        merchantId,
        isActive: true,
      },
    });

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error("[POST /api/deals/create] Error:", error);
    return NextResponse.json(
      { error: "Failed to create deal" },
      { status: 500 },
    );
  }
}
