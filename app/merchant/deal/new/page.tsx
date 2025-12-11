'use client';
import { useState } from 'react';

export default function NewDealPage() {
  // Pre-fill with your seeded merchant ID for now
  const [merchantId, setMerchantId] = useState('11111111-1111-1111-1111-111111111111');
  const [title, setTitle] = useState('10% Off Special');
  const [description, setDescription] = useState('Valid on all menu items.');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0,16));
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date(); d.setDate(d.getDate()+30);
    return d.toISOString().slice(0,16);
  });
  const [terms, setTerms] = useState('One per customer.');
  const [maxRedemptions, setMaxRedemptions] = useState<number | ''>(200);
  const [perUserLimit, setPerUserLimit] = useState<number | ''>(1);

  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{shortCode:string; redeemUrl:string; qrPngUrl:string} | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setMsg(null); setResult(null);
    const res = await fetch('/api/deals/create', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        merchantId,
        title,
        description,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        terms,
        maxRedemptions: maxRedemptions === '' ? null : Number(maxRedemptions),
        perUserLimit: perUserLimit === '' ? null : Number(perUserLimit),
      }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) { setMsg(data.error || 'Failed'); return; }
    setResult({ shortCode: data.shortCode, redeemUrl: data.redeemUrl, qrPngUrl: data.qrPngUrl });
    setMsg('✅ Deal created');
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Create a Deal</h1>

      <label className="text-xs">Merchant ID</label>
      <input className="border p-2 rounded w-full" value={merchantId} onChange={e=>setMerchantId(e.target.value)} />

      <label className="text-xs">Title</label>
      <input className="border p-2 rounded w-full" value={title} onChange={e=>setTitle(e.target.value)} />

      <label className="text-xs">Description</label>
      <textarea className="border p-2 rounded w-full" value={description} onChange={e=>setDescription(e.target.value)} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs">Starts At</label>
          <input type="datetime-local" className="border p-2 rounded w-full" value={startsAt} onChange={e=>setStartsAt(e.target.value)} />
        </div>
        <div>
          <label className="text-xs">Ends At</label>
          <input type="datetime-local" className="border p-2 rounded w-full" value={endsAt} onChange={e=>setEndsAt(e.target.value)} />
        </div>
      </div>

      <label className="text-xs">Terms (optional)</label>
      <input className="border p-2 rounded w-full" value={terms} onChange={e=>setTerms(e.target.value)} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs">Max Redemptions (optional)</label>
          <input className="border p-2 rounded w-full" value={maxRedemptions} onChange={e=>setMaxRedemptions(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs">Per User Limit (optional)</label>
          <input className="border p-2 rounded w-full" value={perUserLimit} onChange={e=>setPerUserLimit(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
      </div>

      <button onClick={submit} disabled={busy} className="bg-black text-white rounded p-2 w-full">
        {busy ? 'Creating…' : 'Create Deal'}
      </button>

      {msg && <p className={`mt-2 ${msg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>{msg}</p>}

      {result && (
        <div className="mt-4 space-y-2 border rounded p-3">
          <div>Short code: <span className="font-mono">{result.shortCode}</span></div>
          <div><a className="text-blue-600 underline" href={result.redeemUrl} target="_blank">Open redeem page</a></div>
          <div><a className="text-blue-600 underline" href={result.qrPngUrl} target="_blank">Download QR</a></div>
        </div>
      )}
    </div>
  );
}
