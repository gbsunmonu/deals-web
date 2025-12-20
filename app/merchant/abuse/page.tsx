import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Row = {
  device_hash: string;
  blocks: number;
  last_seen: string;
  reasons: string;
};

export default async function AbuseDashboardPage() {
  // ✅ Require merchant login
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await (await supabase).auth.getUser();

  if (!user) redirect("/login");

  // ✅ Resolve merchant record
  const merchant = await prisma.merchant.findFirst({
    where: { userId: user.id },
    select: { id: true, name: true },
  });

  if (!merchant) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Abuse dashboard</h1>
        <p className="mt-2 text-slate-600">
          No merchant profile found for this account.
        </p>
      </main>
    );
  }

  // ✅ Merchant-only: only logs where requested deal belongs to this merchant
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      l.device_hash,
      COUNT(*)::int as blocks,
      MAX(l.created_at)::text as last_seen,
      STRING_AGG(DISTINCT l.reason, ', ') as reasons
    FROM "RedemptionBlockLog" l
    JOIN "Deal" d ON d.id = l.requested_deal_id
    WHERE d."merchantId" = ${merchant.id}
      AND l.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY l.device_hash
    HAVING COUNT(*) > 1
    ORDER BY blocks DESC, last_seen DESC
    LIMIT 50
  `;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Abuse dashboard
        </h1>
        <p className="mt-2 text-slate-600">
          Merchant: <span className="font-semibold">{merchant.name}</span> — shows devices
          repeatedly blocked (last 7 days).
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-600">No repeat hoarding blocks yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b">
                  <th className="py-2 pr-3">Device hash</th>
                  <th className="py-2 pr-3">Blocks</th>
                  <th className="py-2 pr-3">Reasons</th>
                  <th className="py-2 pr-3">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.device_hash} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-mono text-slate-800">
                      {r.device_hash}
                    </td>
                    <td className="py-2 pr-3 text-slate-800">{r.blocks}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.reasons}</td>
                    <td className="py-2 pr-3 text-slate-700">
                      {new Date(r.last_seen).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[11px] text-slate-500">
          Note: we log both anti-hoarding blocks (ACTIVE_QR_EXISTS) and cooldown blocks (COOLDOWN).
        </p>
      </section>
    </main>
  );
}
