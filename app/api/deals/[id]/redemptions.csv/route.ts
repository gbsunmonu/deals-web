// app/api/merchant/deals/[id]/redemptions.csv/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function csvEscape(v: any) {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Merchant auth
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Map Supabase user → Merchant row
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id as any },
      select: { id: true },
    });

    if (!merchant) {
      return NextResponse.json({ ok: false, error: "Not a merchant" }, { status: 403 });
    }

    const { id: dealId } = await ctx.params;

    // ✅ Ownership check: deal must belong to this merchant
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, merchantId: merchant.id },
      select: { id: true, title: true },
    });

    if (!deal) {
      return NextResponse.json({ ok: false, error: "Deal not found" }, { status: 404 });
    }

    // Only redeemed codes (you can change to include all issued codes if you want)
    const redemptions = await prisma.redemption.findMany({
      where: { dealId: deal.id, redeemedAt: { not: null } },
      orderBy: { redeemedAt: "desc" },
      take: 5000,
      select: {
        shortCode: true,
        code: true,
        redeemedAt: true,
        createdAt: true,
      },
    });

    const header = ["dealId", "dealTitle", "shortCode", "code", "redeemedAt", "createdAt"];
    const lines: string[] = [header.join(",")];

    for (const r of redemptions) {
      lines.push(
        [
          csvEscape(deal.id),
          csvEscape(deal.title),
          csvEscape(r.shortCode),
          csvEscape(r.code),
          csvEscape(r.redeemedAt ? r.redeemedAt.toISOString() : ""),
          csvEscape(r.createdAt ? r.createdAt.toISOString() : ""),
        ].join(",")
      );
    }

    const csv = lines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="deal-${deal.id}-redeemed-codes.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("GET /api/merchant/deals/[id]/redemptions.csv error:", e);
    return NextResponse.json(
      { ok: false, error: "Server error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
