// app/merchant/analytics/page.tsx
import Link from "next/link";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function parseDateISO(v: string | undefined) {
  if (!v) return null;
  // YYYY-MM-DD
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function fmt(n: number) {
  return n.toLocaleString("en-NG");
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function rate(a: number, b: number) {
  return b > 0 ? `${Math.round((a / b) * 100)}%` : "—";
}

export default async function MerchantAnalyticsPage({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}) {
  const sp: SP =
    searchParams instanceof Promise ? await searchParams : (searchParams ?? {});

  // Date range
  const fromQ = parseDateISO(first(sp.from));
  const toQ = parseDateISO(first(sp.to));

  const now = new Date();
  const from = fromQ ?? daysAgo(7);
  const to = toQ ? new Date(toQ.getTime() + 24 * 60 * 60 * 1000) : now; // inclusive end-day

  const fromIso = from.toISOString().slice(0, 10);
  const toIso = (toQ ?? now).toISOString().slice(0, 10);

  // Merchant selection (temporary): ?merchantId=UUID
  const merchantIdQ = first(sp.merchantId);
  let merchant =
    merchantIdQ
      ? await prisma.merchant.findUnique({
          where: { id: String(merchantIdQ) },
          select: { id: true, name: true, city: true },
        })
      : null;

  if (!merchant) {
    // fallback: first merchant (so the page always works)
    merchant = await prisma.merchant.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, city: true },
    });
  }

  if (!merchant) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">
          Merchant Analytics
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          No merchants found yet.
        </p>
      </main>
    );
  }

  // Events in range (scoped to merchantId)
  const eventsByType = await prisma.event.groupBy({
    by: ["type"],
    where: {
      createdAt: { gte: from, lt: to },
      merchantId: merchant.id,
    },
    _count: { _all: true },
  });

  const mapTypeCount = new Map<string, number>();
  for (const r of eventsByType) mapTypeCount.set(String(r.type), r._count._all);

  const dealViews = mapTypeCount.get("DEAL_VIEW") ?? 0;
  const redeemClicks = mapTypeCount.get("DEAL_REDEEM_CLICK") ?? 0;
  const redeemSuccess = mapTypeCount.get("DEAL_REDEEM_SUCCESS") ?? 0;
  const merchantProfileViews = mapTypeCount.get("MERCHANT_PROFILE_VIEW") ?? 0;
  const exploreViews = mapTypeCount.get("EXPLORE_VIEW") ?? 0;

  // Top deals by views (merchant scoped)
  const topDealViewRows = await prisma.event.groupBy({
    by: ["dealId"],
    where: {
      type: "DEAL_VIEW",
      createdAt: { gte: from, lt: to },
      merchantId: merchant.id,
      dealId: { not: null },
    },
    _count: { _all: true },
    // IMPORTANT: Prisma groupBy order uses _count: { dealId: "desc" } (NOT _all)
    orderBy: { _count: { dealId: "desc" } },
    take: 15,
  });

  const topDealIds = topDealViewRows
    .map((r) => r.dealId)
    .filter(Boolean) as string[];

  const deals = topDealIds.length
    ? await prisma.deal.findMany({
        where: { id: { in: topDealIds } },
        select: { id: true, title: true, endsAt: true, startsAt: true },
      })
    : [];

  const dealMap = new Map(deals.map((d) => [d.id, d]));

  // Counts: active/expired deals for this merchant
  const [activeDeals, expiredDeals] = await Promise.all([
    prisma.deal.count({
      where: {
        merchantId: merchant.id,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    }),
    prisma.deal.count({
      where: {
        merchantId: merchant.id,
        endsAt: { lt: now },
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Merchant Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Merchant:{" "}
            <span className="font-semibold text-slate-900">
              {merchant.name}
            </span>
            {merchant.city ? (
              <span className="text-slate-500"> · {merchant.city}</span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Range:{" "}
            <span className="font-semibold text-slate-900">
              {fromIso} → {toIso}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            href={`/merchant/analytics?merchantId=${merchant.id}&from=${fromIso}&to=${toIso}`}
          >
            Refresh
          </Link>

          <Link
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            href={`/merchant/analytics?merchantId=${merchant.id}&from=${daysAgo(
              7
            )
              .toISOString()
              .slice(0, 10)}&to=${now.toISOString().slice(0, 10)}`}
          >
            Last 7d
          </Link>

          <Link
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            href={`/merchant/analytics?merchantId=${merchant.id}&from=${daysAgo(
              30
            )
              .toISOString()
              .slice(0, 10)}&to=${now.toISOString().slice(0, 10)}`}
          >
            Last 30d
          </Link>
        </div>
      </header>

      {/* KPI cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Active deals" value={fmt(activeDeals)} />
        <Kpi title="Expired deals" value={fmt(expiredDeals)} />
        <Kpi title="Deal views (range)" value={fmt(dealViews)} />
        <Kpi title="Redeem success (range)" value={fmt(redeemSuccess)} />
      </section>

      {/* Funnel */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Funnel (range)</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FunnelCard
            title="Explore views"
            value={fmt(exploreViews)}
            sub="EXPLORE_VIEW (global)"
          />
          <FunnelCard
            title="Merchant profile views"
            value={fmt(merchantProfileViews)}
            sub={`MERCHANT_PROFILE_VIEW · ${rate(
              merchantProfileViews,
              exploreViews
            )} of Explore`}
          />
          <FunnelCard
            title="Deal views"
            value={fmt(dealViews)}
            sub={`DEAL_VIEW · ${rate(dealViews, merchantProfileViews)} of profile`}
          />
          <FunnelCard
            title="Redeem"
            value={fmt(redeemSuccess)}
            sub={`Success ${rate(redeemSuccess, redeemClicks)} of clicks · Clicks ${fmt(
              redeemClicks
            )}`}
          />
        </div>

        <div className="mt-4 text-xs text-slate-600">
          Tip: If Explore is noisy, we’ll also add a merchant-only “entry view”
          event later.
        </div>
      </section>

      {/* Events breakdown */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Events by type</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Type</th>
                <th className="py-2">Count</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(mapTypeCount.entries())
                .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                .map(([t, c]) => (
                  <tr key={t} className="border-t border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{t}</td>
                    <td className="py-2 text-slate-700">{fmt(c)}</td>
                  </tr>
                ))}
              {mapTypeCount.size === 0 ? (
                <tr className="border-t border-slate-100">
                  <td className="py-3 text-slate-500" colSpan={2}>
                    No events in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top deals */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Top deals (by views)
        </h2>
        <div className="mt-3 space-y-3">
          {topDealViewRows.map((r) => {
            const id = r.dealId as string;
            const d = dealMap.get(id);
            return (
              <div
                key={id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {d?.title ?? "Unknown deal"}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Deal ID: <span className="font-mono">{id.slice(0, 8)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    {fmt((r as any)._count?.dealId ?? 0)}
                  </div>
                  <div className="text-[11px] text-slate-500">views</div>
                </div>
              </div>
            );
          })}
          {topDealViewRows.length === 0 ? (
            <div className="text-sm text-slate-500">
              No deal views in this range.
            </div>
          ) : null}
        </div>
      </section>

      <p className="mt-8 text-xs text-slate-500">
        Tip: Add{" "}
        <span className="font-mono">
          ?merchantId=UUID&amp;from=YYYY-MM-DD&amp;to=YYYY-MM-DD
        </span>{" "}
        to filter.
      </p>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function FunnelCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-600">{sub}</div>
    </div>
  );
}
