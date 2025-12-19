// app/merchant/redeem/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { redirect } from "next/navigation";
import RedeemClient, { type RecentRedemptionRow } from "./redeem-client";

export const dynamic = "force-dynamic";

export default async function MerchantRedeemPage() {
  // ✅ Auth (Supabase user)
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ✅ Map Supabase user -> Merchant row (Merchant.userId)
  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: { id: true, name: true },
  });

  if (!merchant) {
    // If you have a better route for onboarding, replace this.
    redirect("/merchant/profile");
  }

  // ✅ Merchant-only recent redemptions
  const recent = await prisma.redemption.findMany({
    where: {
      redeemedAt: { not: null },
      deal: { merchantId: merchant.id },
    },
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
      discountType: String(r.deal.discountType),
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
          Redeem customer QR codes and review recent redemptions for{" "}
          <span className="font-semibold">{merchant.name}</span>.
        </p>
      </header>

      <RedeemClient initialRecent={rows} />
    </main>
  );
}
