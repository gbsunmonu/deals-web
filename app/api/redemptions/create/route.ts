// app/api/redemptions/create/route.ts
// Creates a NEW customer redemption code (short code) for a deal.
// The QR we show customers is a URL like: https://your-domain.com/r/<shortCode>

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function generateUniqueShortCode() {
  for (let i = 0; i < 6; i++) {
    const shortCode = makeShortCode(6);
    const exists = await prisma.redemption.findUnique({
      where: { shortCode },
      select: { id: true },
    });
    if (!exists) return shortCode;
  }
  return makeShortCode(8);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const dealId = body?.dealId as string | undefined;
    if (!dealId || typeof dealId !== "string") {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Create redemption row (NOT redeemed yet)
    for (let i = 0; i < 6; i++) {
      const shortCode = await generateUniqueShortCode();

      try {
        const redemption = await prisma.redemption.create({
          data: {
            dealId,
            // Keep both fields aligned so either lookup works
            code: shortCode,
            shortCode,
          },
          select: {
            id: true,
            code: true,
            shortCode: true,
            redeemedAt: true,
          },
        });

        return NextResponse.json(redemption, { status: 201 });
      } catch (err: any) {
        // Prisma unique constraint violation -> retry
        if (err?.code === "P2002") continue;
        throw err;
      }
    }

    return NextResponse.json(
      { error: "Failed to generate a unique redemption code" },
      { status: 500 }
    );
  } catch (err: any) {
    console.error("[redemptions/create] error:", err);
    return NextResponse.json(
      { error: "Failed to create redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
