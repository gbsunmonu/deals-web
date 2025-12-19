// app/api/merchant/redemptions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const recent = await prisma.redemption.findMany({
      where: {
        redeemedAt: { not: null },
        deal: { merchantId: user.id }, // ✅ merchant-only filter
      },
      orderBy: { redeemedAt: "desc" },
      take: 50,
      select: {
        id: true,
        redeemedAt: true,
        shortCode: true,
        deal: {
          select: {
            id: true,
            title: true,
            discountType: true,
            discountValue: true,
            originalPrice: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        rows: recent.map((r) => ({
          id: r.id,
          redeemedAt: r.redeemedAt ? r.redeemedAt.toISOString() : null,
          shortCode: r.shortCode ?? null,
          deal: {
            id: r.deal.id,
            title: r.deal.title,
            discountType: r.deal.discountType,
            discountValue: Number(r.deal.discountValue ?? 0),
            originalPrice: r.deal.originalPrice ?? null,
          },
        })),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/merchant/redemptions error:", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
