"use client";

import { useMemo, useState } from "react";
import QrScanner from "@/components/merchant/QrScanner";

export type RecentRedemptionRow = {
  id: string;
  redeemedAt: string | null;
  shortCode: string | null;
  deal: {
    id: string;
    title: string;
    discountType: string;
    discountValue: number;
    originalPrice: number | null;
  };
};

type ConfirmOk = {
  ok: true;
  status: "REDEEMED";
  message?: string;
  deal?: { id: string; title: string };
  redemption?: { id: string; redeemedAt: string };
};

type ConfirmErr = {
  ok?: false;
  status?: "EXPIRED" | "SOLD_OUT" | "ALREADY_REDEEMED" | "CONFLICT" | "BAD_QR";
  error?: string;
  redeemedAt?: string;
};

type ConfirmResponse = ConfirmOk | ConfirmErr;

function extractCode(raw: string) {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts.length ? parts[parts.length - 1] : t;
    } catch {
      return t;
    }
  }
  return t;
}

function formatMoneyNGN(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

export default function RedeemClient({ initialRecent }: { initialRecent: RecentRedemptionRow[] }) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const [lastScannedRaw, setLastScannedRaw] = useState<string>("");

  // show recent from server (no extra queries)
  const [recent, setRecent] = useState<RecentRedemptionRow[]>(initialRecent || []);

  const statusTone = useMemo(() => {
    if (!result) return null;
    return (result as any).ok ? "success" : "error";
  }, [result]);

  async function confirmRedeem(rawText: string) {
    const code = extractCode(rawText);
    if (!code) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrText: code }),
      });

      const data = (await res.json().catch(() => ({}))) as ConfirmResponse;

      // normalize error message
      if (!res.ok && !(data as any).error) {
        (data as any).error = "Redemption failed. Please try again.";
      }

      setResult(data);

      // ✅ if redeemed, prepend to recent list (best-effort)
      if ((data as any).ok && (data as any).redemption?.id) {
        const dealTitle = (data as any).deal?.title || "Deal";
        const redeemedAt = (data as any).redemption?.redeemedAt || new Date().toISOString();

        setRecent((prev) => [
          {
            id: (data as any).redemption.id,
            redeemedAt,
            shortCode: extractCode(rawText) || null,
            deal: {
              id: (data as any).deal?.id || "",
              title: dealTitle,
              discountType: "",
              discountValue: 0,
              originalPrice: null,
            },
          },
          ...prev,
        ].slice(0, 20));
      }
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  function onScan(raw: string) {
    setLastScannedRaw(raw);
    confirmRedeem(raw);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Merchant Redeem</h1>
        <p className="mt-1 text-sm text-slate-500">
          Scan the customer QR or paste the code. The QR is valid for 15 minutes.
        </p>
      </header>

      {/* Camera Scanner */}
      <QrScanner
        onResult={onScan}
        onError={(msg) => setResult({ ok: false, error: msg })}
        paused={submitting}
        dedupeMs={1500}
      />

      {/* Manual fallback */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Manual Redeem</p>
        <p className="mt-1 text-xs text-slate-500">
          Paste a short code (e.g. ABC123) or a redeem link.
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste short code or redeem URL…"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={() => confirmRedeem(input)}
            disabled={submitting || !input.trim()}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition",
              submitting || !input.trim()
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700",
            ].join(" ")}
          >
            {submitting ? "Checking…" : "Redeem"}
          </button>
        </div>

        {lastScannedRaw && (
          <p className="mt-2 text-[11px] text-slate-500 break-all">
            Last scan: <span className="font-mono">{lastScannedRaw}</span>
          </p>
        )}
      </section>

      {/* Result UI */}
      {result && (
        <section
          className={[
            "rounded-2xl border p-5 shadow-sm",
            statusTone === "success"
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50",
          ].join(" ")}
        >
          {(result as any).ok ? (
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white text-xl">
                ✓
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-emerald-900">
                  Redeemed successfully
                </p>

                {(result as any).deal?.title && (
                  <p className="mt-1 text-sm text-emerald-900/80">
                    Deal: <span className="font-semibold">{(result as any).deal.title}</span>
                  </p>
                )}

                <p className="mt-1 text-sm text-emerald-900/70">
                  {(result as any).message || "This code is now used and cannot be redeemed again."}
                </p>

                {(result as any).redemption?.redeemedAt && (
                  <p className="mt-2 text-[11px] text-emerald-900/60">
                    Time: {new Date((result as any).redemption.redeemedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-600 text-white text-xl">
                ✗
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-red-900">
                  Redemption failed
                </p>
                <p className="mt-1 text-sm text-red-900/70">
                  {(result as any).error || "This code can’t be redeemed."}
                </p>

                {(result as any).status && (
                  <p className="mt-2 text-[11px] text-red-900/60">
                    Status: {(result as any).status}
                  </p>
                )}

                {(result as any).redeemedAt && (
                  <p className="mt-2 text-[11px] text-red-900/60">
                    Redeemed at: {new Date((result as any).redeemedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Recent redemptions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Recent redemptions</p>
        <p className="mt-1 text-xs text-slate-500">Latest 20 successful redemptions.</p>

        <div className="mt-3 divide-y divide-slate-100">
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No redemptions yet.</p>
          ) : (
            recent.map((r) => (
              <div key={r.id} className="py-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {r.deal.title}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {r.redeemedAt ? new Date(r.redeemedAt).toLocaleString() : "—"}
                  </p>
                </div>

                <div className="text-right">
                  {r.shortCode && (
                    <p className="font-mono text-sm font-semibold text-slate-900">{r.shortCode}</p>
                  )}
                  {typeof r.deal.originalPrice === "number" && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatMoneyNGN(r.deal.originalPrice)}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
