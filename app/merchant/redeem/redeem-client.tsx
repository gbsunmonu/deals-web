"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QrScanner from "@/components/merchant/QrScanner";

type ConfirmOk = {
  ok: true;
  status: "REDEEMED";
  message?: string;
  redemption?: { id: string; redeemedAt: string };
};

type ConfirmErr = {
  ok?: false;
  status?:
    | "EXPIRED"
    | "SOLD_OUT"
    | "ALREADY_REDEEMED"
    | "CONFLICT"
    | "BAD_QR"
    | "FORBIDDEN";
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

function friendlyErrorMessage(data: ConfirmResponse, httpStatus?: number) {
  const status = (data as any)?.status as string | undefined;

  if (httpStatus === 403 || status === "FORBIDDEN") {
    return "This QR belongs to a different merchant. You can only redeem codes for deals under your own merchant account.";
  }
  if (httpStatus === 401) {
    return "You are not logged in as a merchant. Please sign in and try again.";
  }

  if (status === "EXPIRED")
    return "This QR code has expired. Ask the customer to generate a new one.";
  if (status === "SOLD_OUT") return "This deal is sold out.";
  if (status === "ALREADY_REDEEMED") return "This QR code was already redeemed.";
  if (status === "BAD_QR") return "This QR code is not valid.";
  if (status === "CONFLICT") return "Could not redeem right now. Please try again.";

  return (data as any)?.error || "Redemption failed. Please try again.";
}

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

export default function RedeemClient({
  initialRecent = [],
}: {
  initialRecent?: RecentRedemptionRow[];
}) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const [lastScannedRaw, setLastScannedRaw] = useState<string>("");

  // ✅ Recent list state (live-updated)
  const [recent, setRecent] = useState<RecentRedemptionRow[]>(initialRecent);

  // ✅ Cursor for SSE: use a VALUE (not a function) for useRef init
  const initialSince = useMemo(() => {
    const newest = initialRecent
      .map((r) => r.redeemedAt)
      .filter(Boolean)
      .sort()
      .pop();
    return newest || new Date(Date.now() - 60_000).toISOString();
  }, [initialRecent]);

  const sinceRef = useRef<string>(initialSince);

  const statusTone = useMemo(() => {
    if (!result) return null;
    return result.ok === true ? "success" : "error";
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

      if (!res.ok || data.ok !== true) {
        const msg = friendlyErrorMessage(data, res.status);
        setResult({ ...(data as any), ok: false, error: msg });
        return;
      }

      setResult(data);
      setInput("");
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

  // ✅ SSE subscription for live recent list
  useEffect(() => {
    const es = new EventSource(
      `/api/merchant/redemptions/stream?since=${encodeURIComponent(
        sinceRef.current
      )}`
    );

    es.addEventListener("redemption", (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data || "{}") as {
          rows?: RecentRedemptionRow[];
        };
        const rows = payload.rows || [];
        if (!rows.length) return;

        // update cursor
        const newest = rows
          .map((r) => r.redeemedAt)
          .filter(Boolean)
          .sort()
          .pop();
        if (newest) sinceRef.current = newest;

        // merge unique by id, newest first, keep 20
        setRecent((prev) => {
          const map = new Map<string, RecentRedemptionRow>();
          for (const r of prev) map.set(r.id, r);
          for (const r of rows) map.set(r.id, r);

          const merged = Array.from(map.values()).sort((a, b) => {
            const at = a.redeemedAt ? new Date(a.redeemedAt).getTime() : 0;
            const bt = b.redeemedAt ? new Date(b.redeemedAt).getTime() : 0;
            return bt - at;
          });

          return merged.slice(0, 20);
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener("error", () => {
      // EventSource auto-reconnects; we keep UI calm
    });

    return () => es.close();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          Merchant Redeem
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Scan the customer QR or paste the code. Customer QR expires in 15
          minutes.
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
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste short code or redeem URL…"
            rows={3}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="flex flex-col gap-2">
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

            <button
              type="button"
              onClick={() => {
                setInput("");
                setResult(null);
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>

        {lastScannedRaw && (
          <p className="mt-2 text-[11px] text-slate-500 break-all">
            Last scan: <span className="font-mono">{lastScannedRaw}</span>
          </p>
        )}
      </section>

      {/* Result UI (✅ properly narrowed) */}
      {result && (
        <section
          className={[
            "rounded-2xl border p-5 shadow-sm",
            result.ok === true
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50",
          ].join(" ")}
        >
          {result.ok === true ? (
            (() => {
              const ok = result as ConfirmOk;
              return (
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white text-xl">
                    ✓
                  </div>
                  <div>
                    <p className="text-base font-semibold text-emerald-900">
                      Redeemed successfully
                    </p>
                    <p className="mt-1 text-sm text-emerald-900/70">
                      {ok.message ||
                        "This code is now used and cannot be redeemed again."}
                    </p>
                    {ok.redemption?.redeemedAt && (
                      <p className="mt-2 text-[11px] text-emerald-900/60">
                        Time:{" "}
                        {new Date(ok.redemption.redeemedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            (() => {
              const err = result as ConfirmErr;
              return (
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-red-600 text-white text-xl">
                    ✗
                  </div>
                  <div>
                    <p className="text-base font-semibold text-red-900">
                      Redemption failed
                    </p>
                    <p className="mt-1 text-sm text-red-900/70">
                      {err.error || "This code can’t be redeemed."}
                    </p>

                    {err.status && (
                      <p className="mt-2 text-[11px] text-red-900/60">
                        Status: {err.status}
                      </p>
                    )}

                    {err.redeemedAt && (
                      <p className="mt-2 text-[11px] text-red-900/60">
                        Redeemed at:{" "}
                        {new Date(err.redeemedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </section>
      )}

      {/* Recent redemptions (live via SSE) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">
            Recent redemptions
          </p>
          <p className="text-[11px] text-slate-500">Live</p>
        </div>

        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No redemptions yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Deal</th>
                  <th className="py-2 pr-3">Discount</th>
                  <th className="py-2 pr-3">Original price</th>
                  <th className="py-2 pr-3">Short code</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 text-slate-700">
                      {r.redeemedAt
                        ? new Date(r.redeemedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">
                        {r.deal.title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        ID: {r.deal.id}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {r.deal.discountType === "PERCENT"
                        ? `${r.deal.discountValue}%`
                        : r.deal.discountType}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {r.deal.originalPrice ?? "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-700">
                      {r.shortCode ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
