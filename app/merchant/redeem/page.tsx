// app/merchant/redeem/page.tsx
import { prisma } from "@/lib/prisma";
import RedeemClient, { type RecentRedemptionRow } from "./redeem-client";

export const dynamic = "force-dynamic";

export default async function MerchantRedeemPage() {
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
          Redeem customer QR codes and review recent redemptions.
        </p>
      </header>

      <RedeemClient initialRecent={rows} />
    </main>
  );
}
