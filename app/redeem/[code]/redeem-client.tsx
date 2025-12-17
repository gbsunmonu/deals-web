"use client";

// app/redeem/[code]/redeem-client.tsx
import { useMemo, useState } from "react";

type ApiOk = {
  ok: true;
  status: "REDEEMED";
  message?: string;
  deal?: { id: string; title: string };
  merchant?: { id: string; name: string; city?: string | null; address?: string | null; phone?: string | null };
  redemption?: { id: string; redeemedAt: string };
};

type ApiNotOk =
  | { ok?: false; error: string; status?: string; redeemedAt?: string }
  | { error: string; details?: string; status?: string; redeemedAt?: string };

function fmtDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeInputToCode(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  // If it’s a URL like https://your-site/redeem/ABC123 -> extract last segment
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] || "";
      return decodeURIComponent(last).trim();
    } catch {
      return raw;
    }
  }

  // If user pasted JSON, keep it (API supports legacy JSON payload)
  return raw;
}

export default function RedeemClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiOk | null>(null);
  const [err, setErr] = useState<{ title: string; detail?: string } | null>(null);

  const normalized = useMemo(() => normalizeInputToCode(code), [code]);

  async function confirmRedeem() {
    setErr(null);
    setResult(null);

    const finalCode = normalized;
    if (!finalCode) {
      setErr({ title: "Missing code", detail: "Paste a short code or a /redeem/ link first." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Your confirm route accepts { code } or raw string
        body: JSON.stringify({ code: finalCode }),
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as ApiOk | ApiNotOk;

      if (!res.ok) {
        const status = (data as any)?.status;

        if (status === "EXPIRED") {
          setErr({ title: "QR expired", detail: "Ask customer to regenerate a new QR." });
          return;
        }
        if (status === "SOLD_OUT") {
          setErr({ title: "Sold out", detail: "This deal has been fully redeemed." });
          return;
        }
        if (status === "ALREADY_REDEEMED") {
          setErr({
            title: "Already redeemed",
            detail: `Redeemed at: ${fmtDateTime((data as any)?.redeemedAt) || "Unknown time"}`,
          });
          return;
        }
        if (status === "CONFLICT") {
          setErr({ title: "Try again", detail: "Could not redeem due to a conflict. Retry once." });
          return;
        }

        setErr({ title: (data as any)?.error || "Redeem failed", detail: (data as any)?.details });
        return;
      }

      if ((data as any)?.ok) {
        setResult(data as ApiOk);
      } else {
        setErr({ title: (data as any)?.error || "Redeem failed" });
      }
    } catch (e: any) {
      setErr({ title: "Network error", detail: e?.message || "Failed to reach server." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Code / link
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste short code (e.g. ABC123) or full link"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <button
          type="button"
          onClick={confirmRedeem}
          disabled={loading}
          className={[
            "rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition",
            loading ? "bg-slate-200 text-slate-500" : "bg-emerald-600 text-white hover:bg-emerald-700",
          ].join(" ")}
        >
          {loading ? "Confirming…" : "Confirm redeem"}
        </button>
      </div>

      {!!normalized && (
        <p className="mt-2 text-xs text-slate-500">
          Using: <span className="font-mono text-slate-800">{normalized}</span>
        </p>
      )}

      {err && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
          <div className="font-semibold">{err.title}</div>
          {err.detail ? <div className="mt-1 text-red-800/90">{err.detail}</div> : null}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          <div className="font-semibold">✅ Redeemed</div>
          <div className="mt-1 text-emerald-900/80">
            {result.deal?.title ? <div>Deal: {result.deal.title}</div> : null}
            {result.merchant?.name ? <div>Merchant: {result.merchant.name}</div> : null}
            {result.redemption?.redeemedAt ? (
              <div>Time: {fmtDateTime(result.redemption.redeemedAt)}</div>
            ) : null}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] text-slate-400">
        Tip: Customer QR opens this page automatically. You can also paste the short code manually.
      </p>
    </section>
  );
}
