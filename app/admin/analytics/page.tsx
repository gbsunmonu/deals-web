// app/admin/analytics/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

type RangeKey = "7d" | "30d" | "90d";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function getRange(range: RangeKey) {
  const now = new Date();
  const to = now;
  const from =
    range === "7d"
      ? addDays(now, -7)
      : range === "30d"
      ? addDays(now, -30)
      : addDays(now, -90);

  return { from, to };
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: { range?: string };
}) {
  // Guard admin
  const ok = await requireAdmin();
  if (!ok) redirect("/admin/login");

  const range = (searchParams?.range as RangeKey) ?? "7d";
  const { from, to } = getRange(range);

  // KPI cards
  const [visitorsAllTime, visitorsRange, eventsRange] = await Promise.all([
    prisma.visitorProfile.count(),
    prisma.visitorProfile.count({ where: { updatedAt: { gte: from, lt: to } } }),
    prisma.event.count({ where: { createdAt: { gte: from, lt: to } } }),
  ]);

  // Funnel counts
  const funnelTypes = [
    "EXPLORE_VIEW",
    "DEAL_VIEW",
    "DEAL_REDEEM_CLICK",
    "DEAL_REDEEM_SUCCESS",
    "WHATSAPP_CLICK",
  ] as const;

  const funnelCounts = await prisma.event.groupBy({
    by: ["type"],
    where: {
      createdAt: { gte: from, lt: to },
      type: { in: funnelTypes as any },
    },
    _count: { id: true },
  });

  const funnelMap = new Map<string, number>();
  for (const row of funnelCounts) funnelMap.set(String(row.type), row._count.id);

  const exploreViews = funnelMap.get("EXPLORE_VIEW") ?? 0;
  const dealViews = funnelMap.get("DEAL_VIEW") ?? 0;
  const redeemClicks = funnelMap.get("DEAL_REDEEM_CLICK") ?? 0;
  const redeemSuccess = funnelMap.get("DEAL_REDEEM_SUCCESS") ?? 0;
  const whatsappClicks = funnelMap.get("WHATSAPP_CLICK") ?? 0;

  // Top deals by views
  const topDeals = await prisma.event.groupBy({
    by: ["dealId"],
    where: {
      createdAt: { gte: from, lt: to },
      type: "DEAL_VIEW" as any,
      dealId: { not: null },
    },
    _count: { id: true },
    // ✅ Prisma v6 typing: order by count of a field, not _all
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  // Fetch deal titles in one query
  const dealIds = topDeals.map((d) => d.dealId!).filter(Boolean);
  const deals = dealIds.length
    ? await prisma.deal.findMany({
        where: { id: { in: dealIds as string[] } },
        select: { id: true, title: true },
      })
    : [];
  const dealTitleById = new Map(deals.map((d) => [d.id, d.title]));

  // Top merchants by profile views (if you track MERCHANT_PROFILE_VIEW)
  const topMerchants = await prisma.event.groupBy({
    by: ["merchantId"],
    where: {
      createdAt: { gte: from, lt: to },
      type: "MERCHANT_PROFILE_VIEW" as any,
      merchantId: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const merchantIds = topMerchants.map((m) => m.merchantId!).filter(Boolean);
  const merchants = merchantIds.length
    ? await prisma.merchant.findMany({
        where: { id: { in: merchantIds as string[] } },
        select: { id: true, name: true, city: true },
      })
    : [];
  const merchantById = new Map(merchants.map((m) => [m.id, m]));

  // Simple ratios
  const dealViewRate = exploreViews > 0 ? (dealViews / exploreViews) * 100 : 0;
  const redeemClickRate = dealViews > 0 ? (redeemClicks / dealViews) * 100 : 0;
  const redeemSuccessRate =
    redeemClicks > 0 ? (redeemSuccess / redeemClicks) * 100 : 0;

  const rangeLabel =
    range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "Last 90 days";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-slate-600">
            {rangeLabel} ({from.toDateString()} → {to.toDateString()})
          </p>
        </div>

        <div className="flex gap-2">
          <a
            className={`rounded-md border px-3 py-1 text-sm ${
              range === "7d" ? "bg-white font-semibold" : "bg-slate-50"
            }`}
            href="/admin/analytics?range=7d"
          >
            7d
          </a>
          <a
            className={`rounded-md border px-3 py-1 text-sm ${
              range === "30d" ? "bg-white font-semibold" : "bg-slate-50"
            }`}
            href="/admin/analytics?range=30d"
          >
            30d
          </a>
          <a
            className={`rounded-md border px-3 py-1 text-sm ${
              range === "90d" ? "bg-white font-semibold" : "bg-slate-50"
            }`}
            href="/admin/analytics?range=90d"
          >
            90d
          </a>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-600">Visitors (all-time)</div>
          <div className="mt-1 text-2xl font-semibold">{visitorsAllTime}</div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-600">Visitors ({range})</div>
          <div className="mt-1 text-2xl font-semibold">{visitorsRange}</div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-600">Events ({range})</div>
          <div className="mt-1 text-2xl font-semibold">{eventsRange}</div>
        </div>
      </div>

      {/* Funnel */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Funnel</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <Metric label="Explore Views" value={exploreViews} />
          <Metric label="Deal Views" value={dealViews} sub={`${dealViewRate.toFixed(1)}% of explore`} />
          <Metric label="Redeem Clicks" value={redeemClicks} sub={`${redeemClickRate.toFixed(1)}% of views`} />
          <Metric label="Redeem Success" value={redeemSuccess} sub={`${redeemSuccessRate.toFixed(1)}% of clicks`} />
          <Metric label="WhatsApp Clicks" value={whatsappClicks} />
        </div>
      </div>

      {/* Top Deals */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Top Deals (by views)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr>
                <th className="py-2">Deal</th>
                <th className="py-2">Views</th>
              </tr>
            </thead>
            <tbody>
              {topDeals.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={2}>
                    No data in this range.
                  </td>
                </tr>
              ) : (
                topDeals.map((row) => (
                  <tr key={row.dealId ?? "null"} className="border-t">
                    <td className="py-2">
                      {row.dealId ? (
                        <a className="underline" href={`/deals/${row.dealId}`}>
                          {dealTitleById.get(row.dealId) ?? row.dealId}
                        </a>
                      ) : (
                        <span className="text-slate-500">Unknown</span>
                      )}
                    </td>
                    <td className="py-2">{row._count.id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Merchants */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Top Merchants (by profile views)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr>
                <th className="py-2">Merchant</th>
                <th className="py-2">Views</th>
              </tr>
            </thead>
            <tbody>
              {topMerchants.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={2}>
                    No data in this range.
                  </td>
                </tr>
              ) : (
                topMerchants.map((row) => {
                  const m = row.merchantId ? merchantById.get(row.merchantId) : null;
                  return (
                    <tr key={row.merchantId ?? "null"} className="border-t">
                      <td className="py-2">
                        {row.merchantId ? (
                          <span>
                            {m ? (
                              <>
                                <span className="font-medium">{m.name}</span>
                                {m.city ? <span className="text-slate-500"> · {m.city}</span> : null}
                              </>
                            ) : (
                              row.merchantId
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-500">Unknown</span>
                        )}
                      </td>
                      <td className="py-2">{row._count.id}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-600">{sub}</div> : null}
    </div>
  );
}
