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

function pct(numer: number, denom: number) {
  if (!denom || denom <= 0) return 0;
  return clampPct((numer / denom) * 100);
}

function discountedPrice(
  originalPrice: number | null,
  discountValue: number,
  discountType: string
) {
  if (!originalPrice || originalPrice <= 0) return originalPrice;
  const p = clampPct(Number(discountValue ?? 0));
  if (discountType !== "PERCENT" || p <= 0) return originalPrice;
  return Math.max(0, Math.round(originalPrice - (originalPrice * p) / 100));
}

export default async function MerchantAnalyticsPage() {
  // ✅ Merchant auth
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // ✅ Basic KPIs
  const [liveDeals, totalDeals] = await Promise.all([
    prisma.deal.count({
      where: {
        merchantId: merchant.id,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    }),
    prisma.deal.count({ where: { merchantId: merchant.id } }),
  ]);

  // ✅ Funnel totals (today + 7d)
  const [
    dealViewsToday,
    dealViews7d,
    qrCreatedToday,
    qrCreated7d,
    redeemedToday,
    redeemed7d,
    profileViewsToday,
    profileViews7d,
  ] = await Promise.all([
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

    // QR generated == Redemption row created
    prisma.redemption.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        deal: { merchantId: merchant.id },
      },
    }),
    prisma.redemption.count({
      where: {
        createdAt: { gte: weekStart, lte: todayEnd },
        deal: { merchantId: merchant.id },
      },
    }),

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

  // ✅ Per-deal funnel (7d)
  const [viewsByDeal, qrByDeal, redeemedByDeal] = await Promise.all([
    prisma.event.groupBy({
      by: ["dealId"],
      where: {
        type: "DEAL_VIEW",
        merchantId: merchant.id,
        createdAt: { gte: weekStart, lte: todayEnd },
        dealId: { not: null },
      },
      _count: { dealId: true },
    }),

    prisma.redemption.groupBy({
      by: ["dealId"],
      where: {
        createdAt: { gte: weekStart, lte: todayEnd },
        deal: { merchantId: merchant.id },
      },
      _count: { dealId: true },
    }),

    prisma.redemption.groupBy({
      by: ["dealId"],
      where: {
        redeemedAt: { gte: weekStart, lte: todayEnd },
        deal: { merchantId: merchant.id },
      },
      _count: { dealId: true },
    }),
  ]);

  const viewsMap = new Map<string, number>();
  for (const r of viewsByDeal) {
    if (r.dealId) viewsMap.set(String(r.dealId), r._count.dealId);
  }

  const qrMap = new Map<string, number>();
  for (const r of qrByDeal) {
    qrMap.set(String(r.dealId), r._count.dealId);
  }

  const redMap = new Map<string, number>();
  for (const r of redeemedByDeal) {
    redMap.set(String(r.dealId), r._count.dealId);
  }

  const dealIds = Array.from(
    new Set<string>([
      ...Array.from(viewsMap.keys()),
      ...Array.from(qrMap.keys()),
      ...Array.from(redMap.keys()),
    ])
  );

  const deals =
    dealIds.length === 0
      ? []
      : await prisma.deal.findMany({
          where: { id: { in: dealIds }, merchantId: merchant.id },
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

  const rows = dealIds
    .map((id) => {
      const d = dealMap.get(id);
      if (!d) return null;

      const views = viewsMap.get(id) ?? 0;
      const qr = qrMap.get(id) ?? 0;
      const redeems = redMap.get(id) ?? 0;

      const redeemPerView = pct(redeems, views);
      const qrPerView = pct(qr, views);
      const redeemPerQr = pct(redeems, qr);

      const disc = discountedPrice(
        d.originalPrice ?? null,
        Number(d.discountValue ?? 0),
        String(d.discountType)
      );

      return {
        id,
        title: d.title,
        views,
        qr,
        redeems,
        qrPerView,
        redeemPerView,
        redeemPerQr,
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
    qr: number;
    redeems: number;
    qrPerView: number;
    redeemPerView: number;
    redeemPerQr: number;
    originalPrice: number | null;
    discountedPrice: number | null;
    discountType: string;
    discountValue: number;
    endsAt: Date;
  }>;

  // ✅ “Best converting” (Redeem/View), then break ties by views
  const best = [...rows]
    .sort((a, b) => {
      if (b.redeemPerView !== a.redeemPerView) return b.redeemPerView - a.redeemPerView;
      return b.views - a.views;
    })
    .slice(0, 10);

  const funnelRedeemPerView7d = pct(redeemed7d, dealViews7d);
  const funnelQrPerView7d = pct(qrCreated7d, dealViews7d);
  const funnelRedeemPerQr7d = pct(redeemed7d, qrCreated7d);

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
          <p className="mt-1 text-xs text-slate-500">
            Today: {profileViewsToday}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Deal views (7d)
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{dealViews7d}</p>
          <p className="mt-1 text-xs text-slate-500">
            Today: {dealViewsToday}
          </p>
        </div>
      </section>

      {/* Funnel totals */}
      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Funnel totals (last 7 days)</h2>
            <p className="mt-1 text-xs text-slate-500">
              Views are deduped by device/day. QR = redemption rows created.
            </p>
          </div>

          <div className="text-xs text-slate-500">
            Today: <span className="font-semibold text-slate-700">{dealViewsToday}</span> views •{" "}
            <span className="font-semibold text-slate-700">{qrCreatedToday}</span> QR •{" "}
            <span className="font-semibold text-slate-700">{redeemedToday}</span> redeemed
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Views
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{dealViews7d}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              QR generated
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{qrCreated7d}</p>
            <p className="mt-1 text-xs text-slate-500">
              QR/View: <span className="font-semibold">{funnelQrPerView7d}%</span>
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Redeemed
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{redeemed7d}</p>
            <p className="mt-1 text-xs text-slate-500">
              Redeem/View: <span className="font-semibold">{funnelRedeemPerView7d}%</span> •
              Redeem/QR: <span className="font-semibold">{funnelRedeemPerQr7d}%</span>
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

        {best.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No data yet. Get some views + QR generations and this will populate.
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
                {best.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/deals/${r.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {r.title}
                      </Link>
                      <div className="text-[11px] text-slate-500">ID: {r.id}</div>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{r.views}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.qr}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.redeems}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.qrPerView}%</td>
                    <td className="py-2 pr-3 font-semibold text-emerald-700">
                      {r.redeemPerView}%
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{r.redeemPerQr}%</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Full funnel table */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">All deal funnels (7d)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Views → QR → Redeemed per deal.
        </p>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No funnel data yet.
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
                  <th className="py-2 pr-3">Ends</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .sort((a, b) => b.views - a.views)
                  .map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0 align-top">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/deals/${r.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {r.title}
                        </Link>
                        <div className="text-[11px] text-slate-500">ID: {r.id}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{r.views}</td>
                      <td className="py-2 pr-3 text-slate-700">{r.qr}</td>
                      <td className="py-2 pr-3 text-slate-700">{r.redeems}</td>
                      <td className="py-2 pr-3 text-slate-700">{r.qrPerView}%</td>
                      <td className="py-2 pr-3 text-slate-700">{r.redeemPerView}%</td>
                      <td className="py-2 pr-3 text-slate-700">{r.redeemPerQr}%</td>
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
