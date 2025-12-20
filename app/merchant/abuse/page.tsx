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

  // Find the merchant linked to this Supabase user
  const merchant = await prisma.merchant.findFirst({
    where: { userId: user.id },
    select: { id: true, name: true },
  });

  if (!merchant) {
    // If you have a dedicated merchant onboarding page, redirect there instead
    redirect("/merchant");
  }

  // Fetch merchant deal IDs
  const deals = await prisma.deal.findMany({
    where: { merchantId: merchant.id },
    select: { id: true },
  });

  const dealIds = deals.map((d) => d.id);

  const now = new Date();

  // If merchant has no deals, show empty state
  if (dealIds.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Abuse / Anti-hoarding
          </h1>
          <p className="mt-2 text-slate-600">
            Track devices holding active QRs for your deals.
          </p>
        </header>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          You don’t have any deals yet — create a deal first, then this page will show active QRs and hoarding signals.
        </div>
      </main>
    );
  }

  /**
   * HOARDERS (devices holding multiple ACTIVE QRs for this merchant’s deals)
   * Active = activeKey != null AND redeemedAt == null AND expiresAt > now
   */
  const grouped = await prisma.redemption.groupBy({
    by: ["deviceHash"],
    where: {
      dealId: { in: dealIds },
      deviceHash: { not: null },
      activeKey: { not: null },
      redeemedAt: null,
      expiresAt: { gt: now },
    },
    _count: { _all: true },
    // Only show devices with 2+ active QRs (true hoarding)
    having: {
      _count: {
        _all: { gt: 1 },
      },
    },
    orderBy: {
      _count: { _all: "desc" },
    },
    take: 50,
  });

  const hoarders: HoarderRow[] = await Promise.all(
    grouped.map(async (g) => {
      const soonest = await prisma.redemption.findFirst({
        where: {
          dealId: { in: dealIds },
          deviceHash: g.deviceHash,
          activeKey: { not: null },
          redeemedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: "asc" },
        select: { expiresAt: true },
      });

      return {
        deviceHash: g.deviceHash ?? "",
        activeCount: g._count._all,
        soonestExpiryIso: soonest?.expiresAt ? soonest.expiresAt.toISOString() : null,
      };
    })
  );

  /**
   * ACTIVE QR LIST (for this merchant’s deals)
   */
  const active = await prisma.redemption.findMany({
    where: {
      dealId: { in: dealIds },
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
          Merchant: <span className="font-medium text-slate-900">{merchant.name}</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          This page shows devices holding multiple active QRs and the list of currently active QRs (unredeemed + unexpired).
        </p>
      </header>

      {/* Hoarders */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Devices holding multiple active QRs</h2>
          <span className="text-[11px] text-slate-500">Auto-detected</span>
        </div>

        {hoarders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            ✅ No hoarding detected right now (no device has 2+ active QRs for your deals).
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
                    <td className="py-2 pr-3 font-mono text-slate-700">{maskHash(h.deviceHash)}</td>
                    <td className="py-2 pr-3 font-semibold text-amber-700">{h.activeCount}</td>
                    <td className="py-2 pr-3 text-slate-700">
                      {h.soonestExpiryIso ? new Date(h.soonestExpiryIso).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-3 text-[11px] text-slate-500">
              Tip: your claim API anti-hoarding setting should block new QR generation when a device already has an active QR.
              If you still see hoarders here, your limit might be set higher than 1 or some old QRs weren’t unlocked yet.
            </p>
          </div>
        )}
      </section>

      {/* Active QRs */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Active QRs (unredeemed + unexpired)</h2>
          <span className="text-[11px] text-slate-500">{activeRows.length} showing</span>
        </div>

        {activeRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active QRs right now.</p>
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
                      {r.expiresAtIso ? new Date(r.expiresAtIso).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{r.dealTitle}</div>
                      <div className="text-[11px] text-slate-500">Deal ID: {r.dealId}</div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-800">{r.shortCode}</td>
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
              Note: this list is “live state”. Once a QR is redeemed or expires, it disappears from this list.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
