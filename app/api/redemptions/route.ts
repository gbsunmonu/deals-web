// app/api/redemptions/route.ts
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

    // Expect dealId, and optionally code.
    const dealId = body?.dealId as string | undefined;
    if (!dealId || typeof dealId !== "string") {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    // If caller provided a code, use it. Otherwise generate one.
    const providedCode = body?.code;
    const code =
      typeof providedCode === "string" && providedCode.trim()
        ? providedCode.trim()
        : await generateUniqueShortCode();

    // Ensure deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Create redemption row (NOT redeemed yet unless your UI expects it)
    // ✅ IMPORTANT: shortCode is REQUIRED by your Prisma schema.
    // Keep it aligned with `code` so scans can find it either way.
    try {
      const redemption = await prisma.redemption.create({
        data: {
          dealId: deal.id,
          code,
          shortCode: code,
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
      // Unique constraint collision: try again with a new code
      if (err?.code === "P2002") {
        const fallback = await generateUniqueShortCode();
        const redemption = await prisma.redemption.create({
          data: {
            dealId: deal.id,
            code: fallback,
            shortCode: fallback,
          },
          select: {
            id: true,
            code: true,
            shortCode: true,
            redeemedAt: true,
          },
        });

        return NextResponse.json(redemption, { status: 201 });
      }

      throw err;
    }
  } catch (err: any) {
    console.error("[/api/redemptions] error:", err);
    return NextResponse.json(
      { error: "Failed to create redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
