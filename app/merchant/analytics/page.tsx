import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatNaira(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `₦${value.toLocaleString("en-NG")}`;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function discountedPrice(originalPrice: number | null, discountValue: number, discountType: string) {
  if (!originalPrice || originalPrice <= 0) return originalPrice;
  const pct = clampPct(Number(discountValue ?? 0));
  if (discountType !== "PERCENT" || pct <= 0) return originalPrice;
  return Math.max(0, Math.round(originalPrice - (originalPrice * pct) / 100));
}

export default async function MerchantAnalyticsPage() {
  const supabase = await getServerSupabaseRSC();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id as any },
    select: { id: true, name: true },
  });
  if (!merchant) redirect("/merchant/profile");

  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  // KPI: deals + redemptions
  const [liveDeals, totalDeals, redeemedToday, redeemed7d] = await Promise.all([
    prisma.deal.count({
      where: {
        merchantId: merchant.id,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    }),
    prisma.deal.count({ where: { merchantId: merchant.id } }),
    prisma.redemption.count({
      where: {
        redeemedAt: { gte: todayStart, lte: todayEnd },
        deal: { merchantId: merchant.id },
      },
    }),
    prisma.redemption.count({
      where: {
        redeemedAt: { gte: weekStart, lte: todayEnd },
        deal: { merchantId: merchant.id },
      },
    }),
  ]);

  // KPI: views
  const [dealViewsToday, dealViews7d, profileViewsToday, profileViews7d] = await Promise.all([
    prisma.event.count({
      where: {
        type: "DEAL_VIEW",
        merchantId: merchant.id,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.event.count({
      where: {
        type: "DEAL_VIEW",
        merchantId: merchant.id,
        createdAt: { gte: weekStart, lte: todayEnd },
      },
    }),
    prisma.event.count({
      where: {
        type: "MERCHANT_PROFILE_VIEW",
        merchantId: merchant.id,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.event.count({
      where: {
        type: "MERCHANT_PROFILE_VIEW",
        merchantId: merchant.id,
        createdAt: { gte: weekStart, lte: todayEnd },
      },
    }),
  ]);

  // Top redeemed deals (7d)
  const topRedeemed = await prisma.redemption.groupBy({
    by: ["dealId"],
    where: {
      redeemedAt: { gte: weekStart, lte: todayEnd },
      deal: { merchantId: merchant.id },
    },
    _count: { dealId: true },
    orderBy: { _count: { dealId: "desc" } },
    take: 8,
  });

  // Top viewed deals (7d)
  const topViewed = await prisma.event.groupBy({
    by: ["dealId"],
    where: {
      type: "DEAL_VIEW",
      merchantId: merchant.id,
      createdAt: { gte: weekStart, lte: todayEnd },
      dealId: { not: null },
    },
    _count: { dealId: true },
    orderBy: { _count: { dealId: "desc" } },
    take: 8,
  });

  const topDealIds = Array.from(
    new Set([
      ...topRedeemed.map((r) => r.dealId),
      ...topViewed.map((r) => r.dealId as string),
    ])
  );

  const deals =
    topDealIds.length === 0
      ? []
      : await prisma.deal.findMany({
          where: { id: { in: topDealIds } },
          select: {
            id: true,
            title: true,
            discountType: true,
            discountValue: true,
            originalPrice: true,
            endsAt: true,
          },
        });

  const dealMap = new Map(deals.map((d) => [d.id, d]));
  const viewsMap = new Map(topViewed.map((v) => [String(v.dealId), v._count.dealId]));
  const redMap = new Map(topRedeemed.map((r) => [r.dealId, r._count.dealId]));

  const topRows = topDealIds
    .map((id) => {
      const d = dealMap.get(id);
      if (!d) return null;

      const views = viewsMap.get(id) ?? 0;
      const redemptions = redMap.get(id) ?? 0;

      const disc = discountedPrice(
        d.originalPrice ?? null,
        Number(d.discountValue ?? 0),
        String(d.discountType)
      );

      const conversion = views > 0 ? Math.round((redemptions / views) * 100) : 0;

      return {
        id,
        title: d.title,
        views,
        redemptions,
        conversion,
        originalPrice: d.originalPrice ?? null,
        discountedPrice: disc ?? null,
        discountType: String(d.discountType),
        discountValue: Number(d.discountValue ?? 0),
        endsAt: d.endsAt,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      title: string;
      views: number;
      redemptions: number;
      conversion: number;
      originalPrice: number | null;
      discountedPrice: number | null;
      discountType: string;
      discountValue: number;
      endsAt: Date;
    }>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Merchant
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Analytics
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Performance overview for <span className="font-semibold">{merchant.name}</span>.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/merchant/redeem"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Redeem
          </Link>
          <Link
            href="/merchant/profile"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Merchant home
          </Link>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Live deals
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{liveDeals}</p>
          <p className="mt-1 text-xs text-slate-500">Currently active right now.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Total deals
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalDeals}</p>
          <p className="mt-1 text-xs text-slate-500">All deals created.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Redeemed today
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{redeemedToday}</p>
          <p className="mt-1 text-xs text-slate-500">Since midnight.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Redeemed last 7 days
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{redeemed7d}</p>
          <p className="mt-1 text-xs text-slate-500">Rolling 7-day total.</p>
        </div>
      </section>

      {/* Views KPI */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Deal views today
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{dealViewsToday}</p>
          <p className="mt-1 text-xs text-slate-500">Unique device views.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Deal views 7 days
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{dealViews7d}</p>
          <p className="mt-1 text-xs text-slate-500">Unique device views.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Profile views today
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{profileViewsToday}</p>
          <p className="mt-1 text-xs text-slate-500">Merchant page visits.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Profile views 7 days
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{profileViews7d}</p>
          <p className="mt-1 text-xs text-slate-500">Merchant page visits.</p>
        </div>
      </section>

      {/* Top Deals table */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Top deals (views + redemptions, 7 days)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Conversion = redemptions ÷ views.
            </p>
          </div>
        </div>

        {topRows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Not enough data yet. Once customers view deals and redeem, this will populate.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b">
                  <th className="py-2 pr-3">Deal</th>
                  <th className="py-2 pr-3">Views</th>
                  <th className="py-2 pr-3">Redemptions</th>
                  <th className="py-2 pr-3">Conversion</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Ends</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{r.title}</div>
                      <div className="text-[11px] text-slate-500">ID: {r.id}</div>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{r.views}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.redemptions}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.conversion}%</td>
                    <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">
                      {r.discountType === "PERCENT" && r.discountValue > 0 ? (
                        <>
                          <span className="font-semibold text-emerald-700">
                            {formatNaira(r.discountedPrice)}
                          </span>{" "}
                          <span className="text-xs text-slate-500 line-through">
                            {formatNaira(r.originalPrice)}
                          </span>
                        </>
                      ) : (
                        <span>{formatNaira(r.originalPrice)}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">
                      {new Date(r.endsAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
