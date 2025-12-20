// app/merchant/abuse/device/[hash]/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  created_at: string;
  reason: string;
  retry_after_sec: number | null;

  requested_deal_id: string;
  requested_title: string;

  blocked_deal_id: string | null;
  blocked_title: string | null;

  blocked_short_code: string | null;
  blocked_expires_at: string | null;

  user_agent: string | null;
};

function shortHash(h: string) {
  if (!h) return "";
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

export default async function DeviceAbuseDetailsPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
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

  const { hash } = await params;
  const deviceHash = decodeURIComponent(hash || "").trim();
  if (!deviceHash) redirect("/merchant/abuse");

  // ✅ Only show logs where requested_deal belongs to this merchant
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      rbl."id"::text as id,
      rbl."created_at"::text as created_at,
      rbl."reason" as reason,
      rbl."retry_after_sec" as retry_after_sec,

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
    WHERE
      dreq."merchantId" = CAST(${merchant.id} AS uuid)
      AND rbl."device_hash" = ${deviceHash}
    ORDER BY rbl."created_at" DESC
    LIMIT 250
  `;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Device details
            </h1>
            <p className="mt-1 text-slate-600">
              Merchant: <span className="font-semibold">{merchant.name}</span>
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              Device hash: <span className="font-mono">{deviceHash}</span>{" "}
              <span className="ml-2 font-mono text-slate-400">({shortHash(deviceHash)})</span>
            </p>
          </div>

          <Link
            href="/merchant/abuse"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Back
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Block events</p>
          <p className="text-[11px] text-slate-500">Latest {rows.length} (max 250)</p>
        </div>

        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No block events found for this device (for your merchant).
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
                  <th className="py-2 pr-3">Retry</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>

                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{r.reason}</div>
                      {r.user_agent ? (
                        <div className="mt-1 text-[11px] text-slate-500 break-all">
                          UA: {r.user_agent}
                        </div>
                      ) : null}
                    </td>

                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{r.requested_title}</div>
                      <div className="text-[11px] text-slate-500">
                        ID: <span className="font-mono">{r.requested_deal_id}</span>
                      </div>
                    </td>

                    <td className="py-2 pr-3">
                      {r.blocked_title ? (
                        <>
                          <div className="font-medium text-slate-900">{r.blocked_title}</div>
                          <div className="text-[11px] text-slate-500">
                            Deal:{" "}
                            <span className="font-mono">{r.blocked_deal_id || "—"}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Short:{" "}
                            <span className="font-mono">{r.blocked_short_code || "—"}</span>
                          </div>
                          {r.blocked_expires_at ? (
                            <div className="text-[11px] text-slate-500">
                              Expires: {new Date(r.blocked_expires_at).toLocaleString()}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
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
