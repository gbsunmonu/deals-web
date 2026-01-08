// app/admin/merchants/ui.tsx
"use client";

import * as React from "react";

type MerchantStatus = "PENDING" | "VERIFIED" | "SUSPENDED";

type MerchantRow = {
  id: string;
  name: string;
  city: string | null;
  userId: string | null;
  status: MerchantStatus;
  statusReason: string | null;
  statusUpdatedAt: string | null;
  verifiedAt: string | null;
};

function fmtDate(v: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function MerchantsAdminClient() {
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<MerchantRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<MerchantStatus | "ALL">("ALL");
  const [q, setQ] = React.useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/admin/merchants?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { merchants: MerchantRow[] };
      setRows(data.merchants || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load merchants");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: string, next: MerchantStatus) {
    try {
      const res = await fetch(`/api/admin/merchants`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Update failed (${res.status})`);
      }

      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update merchant");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Merchants</h1>
          <p className="text-sm text-slate-600">
            Approve, suspend, and monitor merchants.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className="rounded-md border bg-white px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <input
            className="rounded-md border bg-white px-3 py-2 text-sm"
            placeholder="Search name/city"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <button
            className="rounded-md border bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={load}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500">No merchants found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">City</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Updated</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="py-2 font-medium">{m.name}</td>
                    <td className="py-2">{m.city ?? "-"}</td>
                    <td className="py-2">{m.status}</td>
                    <td className="py-2">{fmtDate(m.statusUpdatedAt)}</td>
                    <td className="py-2">{m.statusReason ?? "-"}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border px-2 py-1 text-xs"
                          onClick={() => updateStatus(m.id, "VERIFIED")}
                        >
                          Verify
                        </button>
                        <button
                          className="rounded-md border px-2 py-1 text-xs"
                          onClick={() => updateStatus(m.id, "SUSPENDED")}
                        >
                          Suspend
                        </button>
                        <button
                          className="rounded-md border px-2 py-1 text-xs"
                          onClick={() => updateStatus(m.id, "PENDING")}
                        >
                          Pending
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
