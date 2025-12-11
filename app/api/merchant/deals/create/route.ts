// app/api/merchant/deals/create/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DiscountType } from "@prisma/client";

// Optional: if you have this constant already, you can import it instead.
const FALLBACK_DEMO_MERCHANT_ID =
  process.env.DEMO_MERCHANT_ID ?? "11111111-1111-1111-1111-111111111111";

type CreateDealBody = {
  title: string;
  description: string;
  discountValue: number | string;
  startsAt: string; // ISO date string from the form
  endsAt: string;   // ISO date string from the form
  imageUrl?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateDealBody;

    const title = body.title?.trim();
    const description = body.description?.trim();
    const discountValueNumber = Number(body.discountValue);
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    const imageUrl = body.imageUrl ?? null;

    // ---- basic validation ----
    if (!title) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: "Description is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(discountValueNumber) || discountValueNumber < 0) {
      return NextResponse.json(
        { error: "Discount value must be a non-negative number." },
        { status: 400 }
      );
    }

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json(
        { error: "Start and end dates are required." },
        { status: 400 }
      );
    }

    // ---- choose enum value ----
    // ✅ IMPORTANT: this is an actual enum VALUE, not the enum type itself
    const discountType =
      discountValueNumber > 0 ? DiscountType.PERCENT : DiscountType.NONE;

    const merchantId = FALLBACK_DEMO_MERCHANT_ID;

    // ---- insert into DB ----
    const newDeal = await prisma.deal.create({
      data: {
        title,
        description,
        discountValue: discountValueNumber,
        discountType,           // ✅ use the variable, not "DiscountType"
        startsAt,
        endsAt,
        merchantId,
        imageUrl,
        isActive: true,
      },
    });

    return NextResponse.json({ deal: newDeal }, { status: 201 });
  } catch (err) {
    console.error("Create deal error:", err);
    return NextResponse.json(
      { error: "Failed to create deal." },
      { status: 500 }
    );
  }
}
