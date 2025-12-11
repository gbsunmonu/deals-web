// app/api/redemptions/create/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function generateShortCode(length = 5): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O confusion
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const dealId = body?.dealId as string | undefined;

    if (!dealId) {
      return NextResponse.json(
        { error: "dealId is required" },
        { status: 400 }
      );
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    const shortCode = generateShortCode(5);
    const code = `${shortCode}-${Date.now().toString(36).toUpperCase()}`;

    const redemption = await prisma.redemption.create({
      data: {
        code,
        shortCode,
        dealId,
        merchantId: deal.merchantId,
        redeemed: false,
      },
    });

    return NextResponse.json({
      id: redemption.id,
      code: redemption.code,
      shortCode: redemption.shortCode,
      redeemed: redemption.redeemed,
      createdAt: redemption.createdAt,
    });
  } catch (err) {
    console.error("Create redemption error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
