// app/merchant/redeem/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import RedeemClient, { type RecentRedemptionRow } from "./redeem-client";

export const dynamic = "force-dynamic";

export default async function MerchantRedeemPage() {
  // ✅ IMPORTANT: your helper returns a Promise, so we must await it
  const supabase = await getServerSupabaseRSC();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  // Not logged in
  if (userErr || !user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Merchant Redeem
          </h1>
          <p className="mt-2 text-slate-600">
            You must be logged in as a merchant to view redemptions.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-700">Not authenticated.</p>
        </div>
      </main>
    );
  }

  // ✅ Find merchant record for this logged-in user
  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id }, // userId is unique in your schema ✅
    select: { id: true, name: true },
  });

  if (!merchant) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Merchant Redeem
          </h1>
          <p className="mt-2 text-slate-600">
            We couldn’t find a merchant profile linked to your account.
          </p>
        </header>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="text-sm font-semibold">Merchant profile not found</p>
          <p className="mt-1 text-sm">
            Go to your merchant profile setup page and complete onboarding, then
            come back here.
          </p>
        </div>
      </main>
    );
  }

  // ✅ Merchant-only redemptions filter (THIS is the key)
  const recent = await prisma.redemption.findMany({
    where: {
      redeemedAt: { not: null },
      deal: { merchantId: merchant.id }, // ✅ only my deals
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
          Redeem customer QR codes and review recent redemptions for{" "}
          <span className="font-semibold text-slate-900">{merchant.name}</span>.
        </p>
      </header>

      <RedeemClient initialRecent={rows} />
    </main>
  );
}
