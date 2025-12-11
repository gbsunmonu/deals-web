// app/merchant/deal/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type RedemptionRow = { id: string; code: string; createdAt: string };
type Deal = {
  id: string;
  title: string;
  description: string | null;
  shortCode: string;
  startsAt: string;
  endsAt: string;
  maxRedemptions: number | null;
  merchantId: string;
};

export default function DealStatsClient() {
  const sp = useSearchParams();

  const merchantId = useMemo(
    () => (sp.get('merchantId') || '11111111-1111-1111-1111-111111111111').trim(),
    [sp]
  );
  const codeOrId = useMemo(
    () => (sp.get('code') || sp.get('id') || '').trim(),
    [sp]
  );

  // date filters (YYYY-MM-DD)
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [recent, setRecent] = useState<RedemptionRow[]>([]);

  // helpers (UTC-safe)
  function fmt(d: Date) { return d.toISOString().slice(0, 10); }
  function todayUTC() {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  function setLast7Days() {
    const end = todayUTC();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    setFrom(fmt(start));
    setTo(fmt(end));
  }
  function clearRange() { setFrom(''); setTo(''); }

  // fetch stats whenever inputs change
  useEffect(() => {
    if (!codeOrId) {
      setError('Invalid deal id or short code: ""');
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ merchantId, code: codeOrId });
    if (from) params.set('from', from);
    if (to)   params.set('to', to);

    setLoading(true); setError(null);
    fetch(`/api/deal-stats?${params.toString()}`, { cache: 'no-store' })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok || !json.ok) throw new Error(json.error || 'Failed');
        setDeal(json.deal);
        setTotalCount(json.stats.totalCount);
        setRecent(json.stats.recent);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [merchantId, codeOrId, from, to]);

  if (!codeOrId) {
    return <ErrorBox merchantId={merchantId} msg={`Invalid deal id or short code: "" . Open this page from the dashboard.`} />;
  }
  if (loading) return <div className="p-6">Loading…</div>;
  if (error || !deal) return <ErrorBox merchantId={merchantId} msg={error || 'Failed to load'} />;

  const redeemUrl = `/r/${deal.shortCode}`;
  const csvParams = new URLSearchParams({ merchantId, id: deal.id });
  if (from) csvParams.set('from', from);
  if (to)   csvParams.set('to', to);
  const csvUrl = `/api/deal-redemptions.csv?${csvParams.toString()}`;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold truncate">{deal.title}</h1>
          {deal.description && <p className="text-sm text-gray-600">{deal.description}</p>}
          <p className="text-sm mt-1">
            Code: <span className="font-mono">{deal.shortCode}</span>
          </p>
          <p className="text-sm">
            Redemptions (filtered): {totalCount}
            {deal.maxRedemptions ? ` / ${deal.maxRedemptions}` : ''}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a className="bg-black text-white px-3 py-2 rounded text-center" href={redeemUrl} target="_blank">
            Open redeem
          </a>
          <a className="border px-3 py-2 rounded text-center" href={csvUrl}>
            Export CSV
          </a>
        </div>
      </div>

      {/* Minimal date range */}
      <div className="border rounded p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm mb-1">From</label>
          <input type="date" className="border rounded px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">To</label>
          <input type="date" className="border rounded px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-2">
          <button className="border px-3 py-2 rounded" onClick={setLast7Days}>Last 7 days</button>
          <button className="border px-3 py-2 rounded" onClick={clearRange}>All-time</button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link href={{ pathname: '/merchant/dashboard', query: { merchantId } }} className="text-blue-600 underline">
          ← Back to dashboard
        </Link>
        {(from || to) && <div className="text-sm text-gray-600">Showing: {from || 'start'} → {to || 'now'}</div>}
      </div>

      <div className="border rounded">
        <div className="px-4 py-2 font-medium border-b bg-gray-50">
          Recent redemptions (latest 50{(from || to) ? ' — filtered' : ''})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Redemption ID</th>
                <th className="px-4 py-2">Code</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono">{r.id}</td>
                  <td className="px-4 py-2 font-mono">{r.code}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={3}>
                    No redemptions in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ msg, merchantId }: { msg: string; merchantId: string }) {
  return (
    <div className="p-6">
      <p className="text-red-600 font-medium">{msg}</p>
      <p className="mt-2">
        Go back to the{' '}
        <Link href={{ pathname: '/merchant/dashboard', query: { merchantId } }} className="underline text-blue-600">
          dashboard
        </Link>{' '}
        and open a deal from there.
      </p>
    </div>
  );
}
