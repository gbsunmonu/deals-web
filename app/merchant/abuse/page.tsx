// app/merchant/abuse/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Auto-flag thresholds (tune anytime)
 */
const FLAG_HIGH_BLOCKS_7D = 10;
const FLAG_HIGH_BLOCKS_24H = 5;
const FLAG_MEDIUM_BLOCKS_7D = 5;
const FLAG_LOW_BLOCKS_7D = 2;

type SummaryRow = {
  blocks_24h: number;
  blocks_7d: number;
  blocks_30d: number;
  devices_24h: number;
  devices_7d: number;
  devices_30d: number;
};

type TopReasonRow = { reason: string; count: number };
type TopDeviceRow = { device_hash: string; count: number };
type TopDealRow = { deal_id: string; title: string; count: number };

type FlaggedDeviceRow = {
  device_hash: string;
  blocks_24h: number;
  blocks_7d: number;
  unique_deals_7d: number;
  top_reason_7d: string | null;
  severity: "HIGH" | "MEDIUM" | "LOW";
};

type RecentRow = {
  id: string;
  created_at: string;
  reason: string;
  retry_after_sec: number | null;
  device_hash: string;

  requested_deal_id: string;
  requested_title: string;

  blocked_deal_id: string | null;
  blocked_title: string | null;

  blocked_short_code: string | null;
  blocked_expires_at: string | null;

  user_agent: string | null;
};

function fmtInt(n: number) {
  return new Intl.NumberFormat().format(n);
}

function shortHash(h: string) {
  if (!h) return "";
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

function barPct(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function severityBadge(sev: FlaggedDeviceRow["severity"]) {
  if (sev === "HIGH") return "bg-red-100 text-red-800 border-red-200";
  if (sev === "MEDIUM") return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

export default async function MerchantAbusePage() {
  // ✅ Auth
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ✅ Resolve merchantId from Merchant.userId
  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id as any },
    select: { id: true, name: true },
  });

  if (!merchant) redirect("/merchant");
  const merchantId = merchant.id;

  // -------------------------
  // Summary counts
  // -------------------------
  const summaryRows = await prisma.$queryRaw<SummaryRow[]>`
    WITH logs AS (
      SELECT rbl.*
      FROM "RedemptionBlockLog" rbl
      JOIN "Deal" dreq
        ON dreq."id" = rbl."requested_deal_id"
      WHERE dreq."merchantId" = CAST(${merchantId} AS uuid)
    )
    SELECT
      (SELECT COUNT(*)::int FROM logs WHERE "created_at" >= NOW() - INTERVAL '24 hours') AS blocks_24h,
      (SELECT COUNT(*)::int FROM logs WHERE "created_at" >= NOW() - INTERVAL '7 days') AS blocks_7d,
      (SELECT COUNT(*)::int FROM logs WHERE "created_at" >= NOW() - INTERVAL '30 days') AS blocks_30d,
      (SELECT COUNT(DISTINCT "device_hash")::int FROM logs WHERE "created_at" >= NOW() - INTERVAL '24 hours') AS devices_24h,
      (SELECT COUNT(DISTINCT "device_hash")::int FROM logs WHERE "created_at" >= NOW() - INTERVAL '7 days') AS devices_7d,
      (SELECT COUNT(DISTINCT "device_hash")::int FROM logs WHERE "created_at" >= NOW() - INTERVAL '30 days') AS devices_30d
  `;
  const summary =
    summaryRows?.[0] || ({
      blocks_24h: 0,
      blocks_7d: 0,
      blocks_30d: 0,
      devices_24h: 0,
      devices_7d: 0,
      devices_30d: 0,
    } satisfies SummaryRow);

  // -------------------------
  // Flagged devices (auto)
  // -------------------------
  const flagged = await prisma.$queryRaw<FlaggedDeviceRow[]>`
    WITH logs AS (
      SELECT rbl.*
      FROM "RedemptionBlockLog" rbl
      JOIN "Deal" dreq
        ON dreq."id" = rbl."requested_deal_id"
      WHERE dreq."merchantId" = CAST(${merchantId} AS uuid)
    ),
    agg AS (
      SELECT
        "device_hash",
        COUNT(*) FILTER (WHERE "created_at" >= NOW() - INTERVAL '24 hours')::int AS blocks_24h,
        COUNT(*) FILTER (WHERE "created_at" >= NOW() - INTERVAL '7 days')::int AS blocks_7d,
        COUNT(DISTINCT "requested_deal_id") FILTER (WHERE "created_at" >= NOW() - INTERVAL '7 days')::int AS unique_deals_7d
      FROM logs
      GROUP BY "device_hash"
    ),
    top_reason AS (
      SELECT
        l."device_hash",
        (ARRAY_AGG(l."reason" ORDER BY cnt DESC))[1] AS top_reason_7d
      FROM (
        SELECT
          "device_hash",
          "reason",
          COUNT(*)::int AS cnt
        FROM logs
        WHERE "created_at" >= NOW() - INTERVAL '7 days'
        GROUP BY "device_hash", "reason"
      ) l
      GROUP BY l."device_hash"
    )
    SELECT
      a."device_hash" as device_hash,
      a.blocks_24h as blocks_24h,
      a.blocks_7d as blocks_7d,
      a.unique_deals_7d as unique_deals_7d,
      tr.top_reason_7d as top_reason_7d,
      CASE
        WHEN a.blocks_7d >= ${FLAG_HIGH_BLOCKS_7D} OR a.blocks_24h >= ${FLAG_HIGH_BLOCKS_24H} THEN 'HIGH'
        WHEN a.blocks_7d >= ${FLAG_MEDIUM_BLOCKS_7D} THEN 'MEDIUM'
        WHEN a.blocks_7d >= ${FLAG_LOW_BLOCKS_7D} THEN 'LOW'
        ELSE NULL
      END as severity
    FROM agg a
    LEFT JOIN top_reason tr
      ON tr."device_hash" = a."device_hash"
    WHERE
      (
        a.blocks_7d >= ${FLAG_LOW_BLOCKS_7D}
        OR a.blocks_24h >= 1
      )
      AND (
        CASE
          WHEN a.blocks_7d >= ${FLAG_HIGH_BLOCKS_7D} OR a.blocks_24h >= ${FLAG_HIGH_BLOCKS_24H} THEN 'HIGH'
          WHEN a.blocks_7d >= ${FLAG_MEDIUM_BLOCKS_7D} THEN 'MEDIUM'
          WHEN a.blocks_7d >= ${FLAG_LOW_BLOCKS_7D} THEN 'LOW'
          ELSE NULL
        END
      ) IS NOT NULL
    ORDER BY
      CASE
        WHEN a.blocks_7d >= ${FLAG_HIGH_BLOCKS_7D} OR a.blocks_24h >= ${FLAG_HIGH_BLOCKS_24H} THEN 3
        WHEN a.blocks_7d >= ${FLAG_MEDIUM_BLOCKS_7D} THEN 2
        WHEN a.blocks_7d >= ${FLAG_LOW_BLOCKS_7D} THEN 1
        ELSE 0
      END DESC,
      a.blocks_7d DESC,
      a.blocks_24h DESC
    LIMIT 25
  `;

  // -------------------------
  // Top reasons (7d)
  // -------------------------
  const topReasons = await prisma.$queryRaw<TopReasonRow[]>`
    SELECT rbl."reason" as reason, COUNT(*)::int as count
    FROM "RedemptionBlockLog" rbl
    JOIN "Deal" dreq
      ON dreq."id" = rbl."requested_deal_id"
    WHERE dreq."merchantId" = CAST(${merchantId} AS uuid)
      AND rbl."created_at" >= NOW() - INTERVAL '7 days'
    GROUP BY rbl."reason"
    ORDER BY count DESC
    LIMIT 8
  `;

  // -------------------------
  // Top devices (7d)
  // -------------------------
  const topDevices = await prisma.$queryRaw<TopDeviceRow[]>`
    SELECT rbl."device_hash" as device_hash, COUNT(*)::int as count
    FROM "RedemptionBlockLog" rbl
    JOIN "Deal" dreq
      ON dreq."id" = rbl."requested_deal_id"
    WHERE dreq."merchantId" = CAST(${merchantId} AS uuid)
      AND rbl."created_at" >= NOW() - INTERVAL '7 days'
    GROUP BY rbl."device_hash"
    ORDER BY count DESC
    LIMIT 8
  `;

  // -------------------------
  // Top requested deals (7d)
  // -------------------------
  const topRequestedDeals = await prisma.$queryRaw<TopDealRow[]>`
    SELECT dreq."id" as deal_id, dreq."title" as title, COUNT(*)::int as count
    FROM "RedemptionBlockLog" rbl
    JOIN "Deal" dreq
      ON dreq."id" = rbl."requested_deal_id"
    WHERE dreq."merchantId" = CAST(${merchantId} AS uuid)
      AND rbl."created_at" >= NOW() - INTERVAL '7 days'
    GROUP BY dreq."id", dreq."title"
    ORDER BY count DESC
    LIMIT 8
  `;

  // -------------------------
  // Recent log rows (latest 50)
  // -------------------------
  const recent = await prisma.$queryRaw<RecentRow[]>`
    SELECT
      rbl."id"::text as id,
      rbl."created_at"::text as created_at,
      rbl."reason" as reason,
      rbl."retry_after_sec" as retry_after_sec,
      rbl."device_hash" as device_hash,

      rbl."requested_deal_id"::text as requested_deal_id,
      dreq."title" as requested_title,

      rbl."blocked_deal_id"::text as blocked_deal_id,
      dblk."title" as blocked_title,

      rbl."blocked_short_code" as blocked_short_code,
      rbl."blocked_expires_at"::text as blocked_expires_at,

      rbl."user_agent" as user_agent
    FROM "RedemptionBlockLog" rbl
    JOIN "Deal" dreq
      ON dreq."id" = rbl."requested_deal_id"
    LEFT JOIN "Deal" dblk
      ON dblk."id" = rbl."blocked_deal_id"
    WHERE dreq."merchantId" = CAST(${merchantId} AS uuid)
    ORDER BY rbl."created_at" DESC
    LIMIT 50
  `;

  const reasonMax = Math.max(0, ...topReasons.map((r) => r.count));
  const deviceMax = Math.max(0, ...topDevices.map((r) => r.count));
  const dealMax = Math.max(0, ...topRequestedDeals.map((r) => r.count));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Abuse dashboard
        </h1>
        <p className="mt-2 text-slate-600">
          Anti-hoarding blocks for{" "}
          <span className="font-semibold">{merchant.name}</span> (merchant-only).
        </p>
      </header>

      {/* Summary cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Last 24 hours
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {fmtInt(summary.blocks_24h)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {fmtInt(summary.devices_24h)} unique devices
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Last 7 days
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {fmtInt(summary.blocks_7d)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {fmtInt(summary.devices_7d)} unique devices
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Last 30 days
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {fmtInt(summary.blocks_30d)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {fmtInt(summary.devices_30d)} unique devices
          </p>
        </div>
      </section>

      {/* ✅ Flagged devices */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Auto-flagged devices
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              HIGH: ≥{FLAG_HIGH_BLOCKS_7D} blocks/7d or ≥{FLAG_HIGH_BLOCKS_24H}{" "}
              blocks/24h • MEDIUM: ≥{FLAG_MEDIUM_BLOCKS_7D} blocks/7d • LOW:
              ≥{FLAG_LOW_BLOCKS_7D} blocks/7d
            </p>
          </div>
          <p className="text-[11px] text-slate-500">Top 25</p>
        </div>

        {flagged.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No devices meet the flag thresholds yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b">
                  <th className="py-2 pr-3">Severity</th>
                  <th className="py-2 pr-3">Device</th>
                  <th className="py-2 pr-3">Blocks (24h)</th>
                  <th className="py-2 pr-3">Blocks (7d)</th>
                  <th className="py-2 pr-3">Unique deals (7d)</th>
                  <th className="py-2 pr-3">Top reason (7d)</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((d) => (
                  <tr key={d.device_hash} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">
                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold",
                          severityBadge(d.severity),
                        ].join(" ")}
                      >
                        {d.severity}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-800 whitespace-nowrap">
                      {shortHash(d.device_hash)}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {fmtInt(d.blocks_24h)}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {fmtInt(d.blocks_7d)}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {fmtInt(d.unique_deals_7d)}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {d.top_reason_7d || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-3 text-[11px] text-slate-500">
              Device hashes are truncated for display. Use Supabase SQL if you
              need the full hash.
            </p>
          </div>
        )}
      </section>

      {/* Top lists */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Top reasons */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Top reasons (7d)
          </p>
          <div className="mt-3 space-y-2">
            {topReasons.length === 0 ? (
              <p className="text-sm text-slate-500">
                No blocks in the last 7 days.
              </p>
            ) : (
              topReasons.map((r) => (
                <div key={r.reason} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-medium text-slate-800">
                        {r.reason}
                      </span>
                      <span>{fmtInt(r.count)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-900/70"
                        style={{ width: `${barPct(r.count, reasonMax)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top devices */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Top devices (7d)
          </p>
          <div className="mt-3 space-y-2">
            {topDevices.length === 0 ? (
              <p className="text-sm text-slate-500">
                No blocks in the last 7 days.
              </p>
            ) : (
              topDevices.map((d) => (
                <div key={d.device_hash} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-mono text-slate-800">
                        {shortHash(d.device_hash)}
                      </span>
                      <span>{fmtInt(d.count)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-900/70"
                        style={{ width: `${barPct(d.count, deviceMax)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Hash is truncated for display. Use DB to inspect full value.
          </p>
        </div>

        {/* Top requested deals */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Top requested deals (7d)
          </p>
          <div className="mt-3 space-y-2">
            {topRequestedDeals.length === 0 ? (
              <p className="text-sm text-slate-500">
                No blocks in the last 7 days.
              </p>
            ) : (
              topRequestedDeals.map((d) => (
                <div key={d.deal_id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-medium text-slate-800">
                        {d.title}
                      </span>
                      <span>{fmtInt(d.count)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-900/70"
                        style={{ width: `${barPct(d.count, dealMax)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Recent events table */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Recent blocks</p>
          <p className="text-[11px] text-slate-500">Latest 50</p>
        </div>

        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No block events recorded yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2 pr-3">Requested deal</th>
                  <th className="py-2 pr-3">Blocked by</th>
                  <th className="py-2 pr-3">Device</th>
                  <th className="py-2 pr-3">Retry</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-b-0 align-top"
                  >
                    <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>

                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">
                        {r.reason}
                      </div>
                      {r.user_agent ? (
                        <div className="mt-1 text-[11px] text-slate-500 break-all">
                          UA: {r.user_agent}
                        </div>
                      ) : null}
                    </td>

                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">
                        {r.requested_title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        ID: {r.requested_deal_id}
                      </div>
                    </td>

                    <td className="py-2 pr-3">
                      {r.blocked_title ? (
                        <>
                          <div className="font-medium text-slate-900">
                            {r.blocked_title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Deal: {r.blocked_deal_id || "—"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Short:{" "}
                            <span className="font-mono">
                              {r.blocked_short_code || "—"}
                            </span>
                          </div>
                          {r.blocked_expires_at ? (
                            <div className="text-[11px] text-slate-500">
                              Expires:{" "}
                              {new Date(r.blocked_expires_at).toLocaleString()}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-2 pr-3 font-mono text-slate-700 whitespace-nowrap">
                      {shortHash(r.device_hash)}
                    </td>

                    <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">
                      {r.retry_after_sec ? `${r.retry_after_sec}s` : "—"}
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
