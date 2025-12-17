// app/api/deals/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function computeLeftAndSoldOut(max: number | null, redeemedCount: number) {
  const limited = typeof max === "number" && max > 0;
  const left = limited ? Math.max(max - redeemedCount, 0) : null;
  const soldOut = limited ? redeemedCount >= max : false;
  return { left, soldOut };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];

    if (!ids.length || !ids.every((x: any) => typeof x === "string")) {
      return NextResponse.json({ error: "ids must be an array of strings" }, { status: 400 });
    }

    const deals = await prisma.deal.findMany({
      where: { id: { in: ids } },
      select: { id: true, maxRedemptions: true },
    });

    const counts = await prisma.redemption.groupBy({
      by: ["dealId"],
      where: { dealId: { in: ids }, redeemedAt: { not: null } },
      _count: { _all: true },
    });

    const countMap = new Map<string, number>();
    for (const row of counts) countMap.set(row.dealId, row._count._all);

    const out: Record<
      string,
      { id: string; redeemedCount: number; left: number | null; soldOut: boolean; maxRedemptions: number | null }
    > = {};

    for (const d of deals) {
      const redeemedCount = countMap.get(d.id) ?? 0;
      const { left, soldOut } = computeLeftAndSoldOut(d.maxRedemptions ?? null, redeemedCount);

      out[d.id] = {
        id: d.id,
        redeemedCount,
        left,
        soldOut,
        maxRedemptions: d.maxRedemptions ?? null,
      };
    }

    return NextResponse.json({ map: out }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/deals/availability] error:", err);
    return NextResponse.json({ error: "Server error", details: err?.message ?? String(err) }, { status: 500 });
  }
}
