// app/merchant/analytics/deals/[dealId]/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function parseDateParam(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function csvEscape(v: any) {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ dealId: string }> }
) {
  try {
    // ✅ Merchant auth
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id as any },
      select: { id: true, name: true },
    });

    if (!merchant) {
      return NextResponse.json({ error: "not_a_merchant" }, { status: 403 });
    }

    const { dealId } = await ctx.params;

    const deal = await prisma.deal.findFirst({
      where: { id: dealId, merchantId: merchant.id },
      select: { id: true, title: true, merchantId: true },
    });

    if (!deal) {
      return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const fromParam = parseDateParam(url.searchParams.get("from"));
    const toParam = parseDateParam(url.searchParams.get("to"));

    const now = new Date();
    const from =
      fromParam ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // default: last 7 days
    const to = toParam ?? now;

    // ✅ FIX: combine redeemedAt filters in ONE object
    const [redeemedCount, rows] = await Promise.all([
      prisma.redemption.count({
        where: {
          dealId: deal.id,
          redeemedAt: { not: null, gte: from, lte: to },
        },
      }),
      prisma.redemption.findMany({
        where: {
          dealId: deal.id,
          redeemedAt: { not: null, gte: from, lte: to },
        },
        orderBy: { redeemedAt: "desc" },
        take: 5000,
        select: {
          id: true,
          shortCode: true,
          code: true,
          redeemedAt: true,
          createdAt: true,
          deviceHash: true,
        },
      }),
    ]);

    const header = [
      "dealId",
      "dealTitle",
      "redeemedCount",
      "redemptionId",
      "shortCode",
      "code",
      "redeemedAt",
      "createdAt",
      "deviceHash",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rows) {
      lines.push(
        [
          csvEscape(deal.id),
          csvEscape(deal.title),
          csvEscape(redeemedCount),
          csvEscape(r.id),
          csvEscape(r.shortCode),
          csvEscape(r.code),
          csvEscape(r.redeemedAt ? r.redeemedAt.toISOString() : ""),
          csvEscape(r.createdAt ? r.createdAt.toISOString() : ""),
          csvEscape(r.deviceHash ?? ""),
        ].join(",")
      );
    }

    const csv = lines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="deal-${deal.id}-redemptions.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("analytics export error:", e);
    return NextResponse.json(
      { error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
