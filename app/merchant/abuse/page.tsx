// app/merchant/abuse/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type HoarderRow = {
  deviceHash: string;
  activeCount: number;
  soonestExpiryIso: string | null;
};

type ActiveQrRow = {
  id: string;
  shortCode: string;
  dealId: string;
  dealTitle: string;
  deviceHash: string | null;
  expiresAtIso: string | null;
  createdAtIso: string;
};

function maskHash(h: string) {
  if (!h) return "—";
  if (h.length <= 10) return h;
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

export default async function MerchantAbusePage() {
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Find merchant linked to this Supabase user
  const merchant = await prisma.merchant.findFirst({
    where: { userId: user.id },
    select: { id: true, name: true },
  });

  if (!merchant) redirect("/merchant");

  const now = new Date();

  // ✅ HOARDERS via SQL (deviceHash with 2+ active QRs across THIS merchant's deals)
  // Active = activeKey NOT NULL AND redeemedAt IS NULL AND expiresAt > now
  const hoarderRows = await prisma.$queryRaw<
    Array<{
      device_hash: string;
      active_count: number;
      soonest_expiry: Date | null;
    }>
  >`
    SELECT
      r."deviceHash" as device_hash,
      COUNT(*)::int as active_count,
      MIN(r."expiresAt") as soonest_expiry
    FROM "Redemption" r
    JOIN "Deal" d
      ON d."id" = r."dealId"
    WHERE
      d."merchantId" = ${merchant.id}
      AND r."deviceHash" IS NOT NULL
      AND r."activeKey" IS NOT NULL
      AND r."redeemedAt" IS NULL
      AND r."expiresAt" IS NOT NULL
      AND r."expiresAt" > ${now}
    GROUP BY r."deviceHash"
    HAVING COUNT(*) >= 2
    ORDER BY active_count DESC
    LIMIT 50
  `;

  const hoarders: HoarderRow[] = hoarderRows.map((r) => ({
    deviceHash: r.device_hash,
    activeCount: Number(r.active_count || 0),
    soonestExpiryIso: r.soonest_expiry ? r.soonest_expiry.toISOString() : null,
  }));

  // ✅ ACTIVE QR LIST (still Prisma)
  const active = await prisma.redemption.findMany({
    where: {
      deal: { merchantId: merchant.id },
      activeKey: { not: null },
      redeemedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: "asc" },
    take: 200,
    select: {
      id: true,
      shortCode: true,
      dealId: true,
      deviceHash: true,
      expiresAt: true,
      createdAt: true,
      deal: { select: { title: true } },
    },
  });

  const activeRows: ActiveQrRow[] = active.map((r) => ({
    id: r.id,
    shortCode: r.shortCode,
    dealId: r.dealId,
    dealTitle: r.deal.title,
    deviceHash: r.deviceHash ?? null,
    expiresAtIso: r.expiresAt ? r.expiresAt.toISOString() : null,
    createdAtIso: r.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Abuse / Anti-hoarding
        </h1>
        <p className="mt-2 text-slate-600">
          Merchant:{" "}
          <span className="font-medium text-slate-900">{merchant.name}</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          This page shows devices holding multiple active QRs and the list of
          currently active QRs (unredeemed + unexpired).
        </p>
      </header>

      {/* Hoarders */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Devices holding multiple active QRs
          </h2>
          <span className="text-[11px] text-slate-500">Auto-detected</span>
        </div>

        {hoarders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            ✅ No hoarding detected right now (no device has 2+ active QRs for
            your deals).
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b">
                  <th className="py-2 pr-3">Device</th>
                  <th className="py-2 pr-3">Active QRs</th>
                  <th className="py-2 pr-3">Soonest expiry</th>
                </tr>
              </thead>
              <tbody>
                {hoarders.map((h) => (
                  <tr key={h.deviceHash} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-mono text-slate-700">
                      {maskHash(h.deviceHash)}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-amber-700">
                      {h.activeCount}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {h.soonestExpiryIso
                        ? new Date(h.soonestExpiryIso).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-3 text-[11px] text-slate-500">
              Tip: if you still see hoarders here, either your anti-hoarding
              limit is set higher than 1 or older QRs weren’t unlocked yet.
            </p>
          </div>
        )}
      </section>

      {/* Active QRs */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Active QRs (unredeemed + unexpired)
          </h2>
          <span className="text-[11px] text-slate-500">
            {activeRows.length} showing
          </span>
        </div>

        {activeRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No active QRs right now.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b">
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2 pr-3">Deal</th>
                  <th className="py-2 pr-3">Short code</th>
                  <th className="py-2 pr-3">Device</th>
                  <th className="py-2 pr-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 text-slate-700">
                      {r.expiresAtIso
                        ? new Date(r.expiresAtIso).toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">
                        {r.dealTitle}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Deal ID: {r.dealId}
                      </div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-800">
                      {r.shortCode}
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-700">
                      {r.deviceHash ? maskHash(r.deviceHash) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {new Date(r.createdAtIso).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-3 text-[11px] text-slate-500">
              Once a QR is redeemed or expires, it disappears from this list.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
