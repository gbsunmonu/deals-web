// components/upload/DealImageUpload.tsx
'use client';

import { useState } from 'react';

export default function DealImageUpload({
  onUploaded,
  getTarget,
}: {
  onUploaded: (publicPath: string) => void;
  getTarget: () => Promise<{ path: string; url: string; token: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const target = await getTarget();
      const res = await fetch(target.url, {
        method: 'PUT',
        headers: {
          'x-upsert': 'true',
          authorization: `Bearer ${target.token}`,
        },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      onUploaded(target.path);
    } catch (e: any) {
      setErr(e?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <input type="file" accept="image/*" onChange={handleFile} disabled={busy} />
      {busy && <div className="text-sm text-neutral-500">Uploading…</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
    </div>
  );
}
