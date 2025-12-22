"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ScanShortcodeModal from "./scan-shortcode-modal";

function clampCode(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
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

type RedeemOk = {
  ok: true;
  shortCode: string;
  redeemedAt: string;
  deal: { id: string; title: string };
  merchant: { id: string; name: string };
};

type RedeemErr = {
  error: string;
  message?: string;
  redeemedAt?: string;
  endsAt?: string;
  startsAt?: string;
};

type Props = {
  initialRecent?: RecentRedemptionRow[];
};

function formatNaira(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `₦${value.toLocaleString("en-NG")}`;
}

function computeDiscountLine(row: RecentRedemptionRow) {
  const { discountType, discountValue, originalPrice } = row.deal;

  if (!originalPrice || originalPrice <= 0) return "—";

  if (discountType === "PERCENT" && discountValue > 0) {
    const discounted = Math.max(
      0,
      Math.round(originalPrice - (originalPrice * discountValue) / 100)
    );
    return `${discountValue}% off → ${formatNaira(discounted)}`;
  }

  return formatNaira(originalPrice);
}

function timeAgo(msAgo: number) {
  if (msAgo < 1000) return "just now";
  const s = Math.floor(msAgo / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

// ✅ tiny beep without assets (Web Audio)
function playSuccessBeep() {
  try {
    if (typeof window === "undefined") return;

    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 880; // beep pitch

    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.13);

    osc.onended = () => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

function vibrateSuccess() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      // short double buzz
      (navigator as any).vibrate?.([60, 40, 80]);
    }
  } catch {
    // ignore
  }
}

export default function RedeemClient({ initialRecent = [] }: Props) {
  const [shortCode, setShortCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<RedeemOk | null>(null);
  const [err, setErr] = useState<RedeemErr | null>(null);
  const [recent, setRecent] = useState<RecentRedemptionRow[]>(initialRecent);

  // ✅ Scan modal
  const [scanOpen, setScanOpen] = useState(false);

  // ✅ NEW: auto-focus manual input when scan closes
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ✅ Streaming status
  const [lastUpdateAt, setLastUpdateAt] = useState<Date | null>(null);
  const [lastUpdateLabel, setLastUpdateLabel] = useState<string>("—");
  const [streamError, setStreamError] = useState<string | null>(null);

  // Prevent double-starting stream in React strict mode
  const startedStreamRef = useRef(false);

  // Prevent concurrent redeems
  const redeemingRef = useRef(false);

  // Dedupe auto-redeem for same scanned code
  const lastAutoRedeemRef = useRef<{ code: string; ts: number } | null>(null);

  const canSubmit = useMemo(() => {
    const c = clampCode(shortCode);
    return !loading && c.length >= 4;
  }, [shortCode, loading]);

  function focusManualInputSoon() {
    // Slight delay so DOM is ready after modal unmount
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
  }

  function handleCloseScan() {
    setScanOpen(false);
    focusManualInputSoon();
  }

  async function redeemNow(passedCode?: string) {
    const code = clampCode(passedCode ?? shortCode);
    if (!code || code.length < 4) return;

    if (redeemingRef.current) return;
    redeemingRef.current = true;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const res = await fetch("/api/redeem/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ shortCode: code }),
      });

      const data = (await res.json().catch(() => ({}))) as RedeemOk | RedeemErr;

      if (!res.ok || !(data as any)?.ok) {
        const e = data as RedeemErr;
        setErr({
          error: e.error || "redeem_failed",
          message: e.message || "Could not redeem. Try again.",
          redeemedAt: e.redeemedAt,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
        });
        return;
      }

      const okData = data as RedeemOk;
      setOk(okData);
      setShortCode("");

      // ✅ Success feedback (mobile cashier UX)
      vibrateSuccess();
      playSuccessBeep();

      // Optimistic insert (stream will correct details shortly)
      const newRow: RecentRedemptionRow = {
        id: `local_${okData.shortCode}_${okData.redeemedAt}`,
        redeemedAt: okData.redeemedAt,
        shortCode: okData.shortCode,
        deal: {
          id: okData.deal.id,
          title: okData.deal.title,
          discountType: "PERCENT",
          discountValue: 0,
          originalPrice: null,
        },
      };

      setRecent((prev) => [newRow, ...prev].slice(0, 20));
      setLastUpdateAt(new Date());
      setStreamError(null);

      // ✅ after success, put cursor ready for next customer
      focusManualInputSoon();
    } catch (e: any) {
      setErr({ error: "network_error", message: e?.message || "Network error." });
    } finally {
      setLoading(false);
      redeemingRef.current = false;
    }
  }

  // ✅ Called by scanner modal: auto-fill + auto-redeem
  async function onScanDetected(code: string) {
    const c = clampCode(code);
    if (!c) return;

    setShortCode(c);

    const now = Date.now();
    const last = lastAutoRedeemRef.current;
    if (last && last.code === c && now - last.ts < 2500) return;
    lastAutoRedeemRef.current = { code: c, ts: now };

    await redeemNow(c);
  }

  // ✅ STREAM: listen to SSE and update recent list
  useEffect(() => {
    if (startedStreamRef.current) return;
    startedStreamRef.current = true;

    let es: EventSource | null = null;

    try {
      es = new EventSource("/api/merchant/redemptions/stream");

      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data || "{}") as {
            ok?: boolean;
            rows?: RecentRedemptionRow[];
            error?: string;
          };

          if (payload?.rows && Array.isArray(payload.rows)) {
            setRecent(payload.rows.slice(0, 20));
            setLastUpdateAt(new Date());
            setStreamError(null);
          } else if (payload?.error) {
            setStreamError(payload.error);
          } else {
            setLastUpdateAt(new Date());
          }
        } catch {
          // ignore
        }
      };

      es.onerror = () => {
        setStreamError("Stream disconnected. Retrying…");
      };
    } catch (e: any) {
      setStreamError(e?.message || "Stream failed to start.");
    }

    return () => {
      try {
        es?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  // ✅ Update “Last update: … ago”
  useEffect(() => {
    const t = setInterval(() => {
      if (!lastUpdateAt) {
        setLastUpdateLabel("—");
        return;
      }
      setLastUpdateLabel(timeAgo(Date.now() - lastUpdateAt.getTime()));
    }, 1000);

    return () => clearInterval(t);
  }, [lastUpdateAt]);

  return (
    <>
      <ScanShortcodeModal
        open={scanOpen}
        onClose={handleCloseScan}
        onDetected={onScanDetected}
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: Scan primary + Manual secondary */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Redeem a customer QR</p>
          <p className="mt-1 text-xs text-slate-500">
            Scan is fastest. Manual entry is backup.
          </p>

          {/* ✅ PRIMARY CTA: Scan */}
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="mt-4 w-full rounded-3xl bg-emerald-600 px-4 py-4 text-left text-white shadow-sm transition hover:bg-emerald-700"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
                  Primary
                </p>
                <p className="mt-1 text-lg font-semibold">Scan customer QR</p>
                <p className="mt-1 text-[12px] text-white/85">
                  Auto-fills the short code and redeems instantly.
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-white/15 px-3 py-2 text-sm font-semibold">
                Open
              </div>
            </div>
          </button>

          {/* Status blocks */}
          {err ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
              <p className="font-semibold">Failed</p>
              <p className="mt-1">{err.message || err.error}</p>

              {err.redeemedAt ? (
                <p className="mt-2 text-xs text-red-700">
                  Redeemed at: {new Date(err.redeemedAt).toLocaleString()}
                </p>
              ) : null}
              {err.startsAt ? (
                <p className="mt-1 text-xs text-red-700">
                  Starts at: {new Date(err.startsAt).toLocaleString()}
                </p>
              ) : null}
              {err.endsAt ? (
                <p className="mt-1 text-xs text-red-700">
                  Ends at: {new Date(err.endsAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}

          {ok ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              <p className="font-semibold">Redeemed ✅</p>
              <p className="mt-1">
                <span className="font-semibold">{ok.deal.title}</span> — code{" "}
                <span className="font-mono font-semibold">{ok.shortCode}</span>
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                Time: {new Date(ok.redeemedAt).toLocaleString()}
              </p>
            </div>
          ) : null}

          {/* ✅ SECONDARY: Manual entry */}
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Manual entry (backup)
            </p>

            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Short code
            </label>
            <input
              ref={inputRef}
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
              placeholder="e.g. J7YQR"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono tracking-wider text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />

            <button
              type="button"
              onClick={() => redeemNow()}
              disabled={!canSubmit}
              className={[
                "mt-3 w-full rounded-full px-4 py-2 text-sm font-semibold transition",
                !canSubmit
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-black text-white hover:bg-slate-900",
              ].join(" ")}
            >
              {loading ? "Redeeming…" : "Redeem manually"}
            </button>

            <p className="mt-3 text-[11px] text-slate-500">
              If a customer’s QR is expired, they must refresh it on the deal page.
            </p>
          </div>
        </div>

        {/* Right: Recent redemptions */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Recent redemptions</p>
              <p className="mt-1 text-xs text-slate-500">
                Latest 20 for your store (live streaming).
              </p>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Last update
              </p>
              <p className="mt-1 text-xs font-medium text-slate-700">{lastUpdateLabel}</p>
            </div>
          </div>

          {streamError ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {streamError}
            </div>
          ) : null}

          {recent.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              No redemptions yet.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="border-b">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Deal</th>
                    <th className="py-2 pr-3">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                        {r.redeemedAt ? new Date(r.redeemedAt).toLocaleString() : "—"}
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-700 whitespace-nowrap">
                        {r.shortCode || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-900">{r.deal.title}</div>
                        <div className="text-[11px] text-slate-500">ID: {r.deal.id}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">
                        {computeDiscountLine(r)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
            Streaming is active. If the network drops, it auto-reconnects.
          </div>
        </div>
      </section>
    </>
  );
}
