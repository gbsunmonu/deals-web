// app/api/deals/[id]/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params;

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        title: true,
        maxRedemptions: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const redeemedCount = await prisma.redemption.count({
      where: {
        dealId,
        redeemedAt: { not: null },
      },
    });

    const max = deal.maxRedemptions;
    const limited = typeof max === "number" && max > 0;

    const left = limited ? Math.max(max - redeemedCount, 0) : null;
    const soldOut = limited ? redeemedCount >= max : false;

    return NextResponse.json(
      {
        ok: true,
        deal: {
          id: deal.id,
          title: deal.title,
          maxRedemptions: deal.maxRedemptions ?? null,
          startsAt: deal.startsAt,
          endsAt: deal.endsAt,
        },
        redeemedCount,
        left,
        soldOut,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[deal availability] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch availability", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
