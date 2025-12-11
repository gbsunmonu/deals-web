// deals-web/app/api/deals/route.ts
import { NextResponse } from "next/server";
import prisma from "@/utils/prismaClient";
import { getCurrentMerchant } from "@/utils/current-merchant";

export async function POST(req: Request) {
  try {
    const merchant = await getCurrentMerchant();

    if (!merchant) {
      return NextResponse.json(
        { error: "Not authenticated as a merchant" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      title,
      description,
      discountValue,
      startsAt,
      endsAt,
      imageUrl,
    } = body;

    const deal = await prisma.deal.create({
      data: {
        title,
        description,
        discountValue,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        imageUrl,
        merchantId: merchant.id, // id column from Merchant table
      },
    });

    return NextResponse.json({ deal }, { status: 201 });
  } catch (err) {
    console.error("Error creating deal:", err);
    return NextResponse.json(
      { error: "Failed to create deal" },
      { status: 500 }
    );
  }
}
