// app/merchant/redeem/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import RedeemClient, { type RecentRedemptionRow } from "./redeem-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MerchantRedeemPage() {
  // ✅ IMPORTANT: getServerSupabaseRSC() returns a Promise in your setup
  const supabase = await getServerSupabaseRSC();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // (Optional) If you have a merchant table keyed by user.id
  // you can enforce merchant-only access here as well.

  const recent = await prisma.redemption.findMany({
    where: { redeemedAt: { not: null } },
    orderBy: { redeemedAt: "desc" },
    take: 20,
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

  const rows: RecentRedemptionRow[] = recent.map((r) => ({
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
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Redemptions
        </h1>
        <p className="mt-2 text-slate-600">
          Scan customer QR codes and review recent redemptions.
        </p>
      </header>

      <RedeemClient initialRecent={rows} />
    </main>
  );
}
