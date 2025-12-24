// app/merchant/analytics/page.tsx
import prisma from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatNaira(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `₦${value.toLocaleString("en-NG")}`;
}

function pct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeDiscountedPrice(originalPrice: number | null, discountValue: number, discountType: string) {
  if (!originalPrice || originalPrice <= 0) return originalPrice;
  const p = pct(Number(discountValue ?? 0));
  if (discountType !== "PERCENT" || p <= 0) return originalPrice;
  return Math.max(0, Math.round(originalPrice - (originalPrice * p) / 100));
}

function safeRate(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

export default async function MerchantAnalyticsPage() {
  const supabase = await getServerSupabaseRSC();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnTo=/merchant/analytics");

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

  // KPIs
  const [
    liveDeals,
    totalDeals,

    // views
    profileViews7d,
    profileViewsToday,
    dealViews7d,
    dealViewsToday,

    // funnel
    qrGenerated7d,
    qrGeneratedToday,
    redeemed7d,
    redeemedToday,
  ] = await Promise.all([
    prisma.deal.count({
      where: { merchantId: merchant.id, startsAt: { lte: now }, endsAt: { gte: now } },
    }),
    prisma.deal.count({ where: { merchantId: merchant.id } }),

    prisma.event.count({
      where: { type: "MERCHANT_PROFILE_VIEW", merchantId: merchant.id, createdAt: { gte: weekStart, lte: todayEnd } },
    }),
    prisma.event.count({
      where: { type: "MERCHANT_PROFILE_VIEW", merchantId: merchant.id, createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.event.count({
      where: { type: "DEAL_VIEW", merchantId: merchant.id, createdAt: { gte: weekStart, lte: todayEnd } },
    }),
    prisma.event.count({
      where: { type: "DEAL_VIEW", merchantId: merchant.id, createdAt: { gte: todayStart, lte: todayEnd } },
    }),

    // QR generated = redemption rows created
    prisma.redemption.count({
      where: { createdAt: { gte: weekStart, lte: todayEnd }, deal: { merchantId: merchant.id } },
    }),
    prisma.redemption.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, deal: { merchantId: merchant.id } },
    }),

    prisma.redemption.count({
      where: { redeemedAt: { gte: weekStart, lte: todayEnd }, deal: { merchantId: merchant.id } },
    }),
    prisma.redemption.count({
      where: { redeemedAt: { gte: todayStart, lte: todayEnd }, deal: { merchantId: merchant.id } },
    }),
  ]);

  // Funnel views (7d) = DEAL_VIEW only
  const views7d = dealViews7d;
  const viewsToday = dealViewsToday;

  // Best converting deals (7d)
  const deals = await prisma.deal.findMany({
    where: { merchantId: merchant.id },
    select: {
      id: true,
      title: true,
      discountType: true,
      discountValue: true,
      originalPrice: true,
    },
  });

  const dealIds = deals.map((d) => d.id);
  const dealMap = new Map(deals.map((d) => [d.id, d]));

  const [viewsByDeal, qrByDeal, redeemedByDeal] = await Promise.all([
    prisma.event.groupBy({
      by: ["dealId"],
      where: {
        type: "DEAL_VIEW",
        merchantId: merchant.id,
        dealId: { in: dealIds },
        createdAt: { gte: weekStart, lte: todayEnd },
      },
      _count: { _all: true },
    }),
    prisma.redemption.groupBy({
      by: ["dealId"],
      where: { dealId: { in: dealIds }, createdAt: { gte: weekStart, lte: todayEnd } },
      _count: { _all: true },
    }),
    prisma.redemption.groupBy({
      by: ["dealId"],
      where: { dealId: { in: dealIds }, redeemedAt: { gte: weekStart, lte: todayEnd } },
      _count: { _all: true },
    }),
  ]);

  const vMap = new Map<string, number>();
  for (const r of viewsByDeal) if (r.dealId) vMap.set(r.dealId, r._count._all);

  const qMap = new Map<string, number>();
  for (const r of qrByDeal) qMap.set(r.dealId, r._count._all);

  const rMap = new Map<string, number>();
  for (const r of redeemedByDeal) rMap.set(r.dealId, r._count._all);

  const rows = dealIds
    .map((id) => {
      const d = dealMap.get(id);
      if (!d) return null;
      const views = vMap.get(id) || 0;
      const qr = qMap.get(id) || 0;
      const redeemed = rMap.get(id) || 0;

      const discounted = computeDiscountedPrice(
        d.originalPrice ?? null,
        Number(d.discountValue ?? 0),
        String(d.discountType)
      );

      return {
        id,
        title: d.title,
        views,
        qr,
        redeemed,
        qrPerView: safeRate(qr, views),
        redeemPerView: safeRate(redeemed, views),
        redeemPerQr: safeRate(redeemed, qr),
        discountedPrice: discounted,
        originalPrice: d.originalPrice ?? null,
        discountType: String(d.discountType),
        discountValue: Number(d.discountValue ?? 0),
      };
    })
    .filter(Boolean) as any[];

  rows.sort((a, b) => {
    // best converting: Redeem/View desc, then Views desc
    if (b.redeemPerView !== a.redeemPerView) return b.redeemPerView - a.redeemPerView;
    return b.views - a.views;
  });

  const topRows = rows.slice(0, 12);

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
            Funnel + performance for <span className="font-semibold">{merchant.name}</span>.
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
          <p className="mt-1 text-xs text-slate-500">Active right now.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Total deals
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalDeals}</p>
          <p className="mt-1 text-xs text-slate-500">All time.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Profile views (7d)
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{profileViews7d}</p>
          <p className="mt-1 text-xs text-slate-500">Today: {profileViewsToday}</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Deal views (7d)
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{dealViews7d}</p>
          <p className="mt-1 text-xs text-slate-500">Today: {dealViewsToday}</p>
        </div>
      </section>

      {/* Funnel */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Funnel totals (last 7 days)</h2>
            <p className="mt-1 text-xs text-slate-500">
              Views are deduped by device/day. QR = redemption rows created.
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            Today: <span className="font-semibold text-slate-700">{viewsToday}</span> views •{" "}
            <span className="font-semibold text-slate-700">{qrGeneratedToday}</span> QR •{" "}
            <span className="font-semibold text-slate-700">{redeemedToday}</span> redeemed
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Views</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{views7d}</p>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">QR generated</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{qrGenerated7d}</p>
            <p className="mt-1 text-xs text-slate-500">
              QR/View: <span className="font-semibold text-slate-700">{safeRate(qrGenerated7d, views7d)}%</span>
            </p>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Redeemed</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{redeemed7d}</p>
            <p className="mt-1 text-xs text-slate-500">
              Redeem/View: <span className="font-semibold text-slate-700">{safeRate(redeemed7d, views7d)}%</span>{" "}
              • Redeem/QR: <span className="font-semibold text-slate-700">{safeRate(redeemed7d, qrGenerated7d)}%</span>
            </p>
          </div>
        </div>
      </section>

      {/* Best converting deals */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Best converting deals (7d)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sorted by Redeem/View (then Views). This is the “real conversion” metric.
        </p>

        {topRows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No data yet.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b">
                  <th className="py-2 pr-3">Deal</th>
                  <th className="py-2 pr-3">Views</th>
                  <th className="py-2 pr-3">QR</th>
                  <th className="py-2 pr-3">Redeemed</th>
                  <th className="py-2 pr-3">QR/View</th>
                  <th className="py-2 pr-3">Redeem/View</th>
                  <th className="py-2 pr-3">Redeem/QR</th>
                  <th className="py-2 pr-3">Price</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{r.title}</div>
                      <div className="text-[11px] text-slate-500">ID: {r.id}</div>
                    </td>
                    <td className="py-2 pr-3">{r.views}</td>
                    <td className="py-2 pr-3">{r.qr}</td>
                    <td className="py-2 pr-3">{r.redeemed}</td>
                    <td className="py-2 pr-3">{r.qrPerView}%</td>
                    <td className="py-2 pr-3 font-semibold text-emerald-700">{r.redeemPerView}%</td>
                    <td className="py-2 pr-3">{r.redeemPerQr}%</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
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
