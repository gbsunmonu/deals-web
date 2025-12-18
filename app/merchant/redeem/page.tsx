"use client";

import { useEffect, useMemo, useState } from "react";

type ConfirmOk = {
  ok: true;
  status: "REDEEMED";
  message?: string;
  deal?: { id: string; title: string };
  merchant?: {
    id: string;
    name: string;
    city?: string | null;
    address?: string | null;
    phone?: string | null;
  };
  redemption?: { id: string; redeemedAt: string | Date };
};

type ConfirmBad = {
  ok?: false;
  status?: "EXPIRED" | "SOLD_OUT" | "ALREADY_REDEEMED" | "CONFLICT";
  error?: string;
  redeemedAt?: string | Date;
};

type ConfirmResponse = ConfirmOk | ConfirmBad;

function prettyTime(d?: string | Date) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeInput(raw: string) {
  const t = (raw || "").trim();
  if (!t) return "";

  // If merchant pastes a URL, keep it (confirm route supports URL)
  if (/^https?:\/\//i.test(t)) return t;

  // If merchant pastes JSON legacy payload, keep it
  if (t.startsWith("{") && t.endsWith("}")) return t;

  // Otherwise assume shortCode
  return t;
}

export default function MerchantRedeemPage() {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ConfirmResponse | null>(null);

  const canSubmit = useMemo(() => normalizeInput(text).length > 0 && !submitting, [text, submitting]);

  async function confirmNow() {
    const payload = normalizeInput(text);
    if (!payload) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // confirm route accepts many shapes; send consistently
        body: JSON.stringify({ qrText: payload }),
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as ConfirmResponse;

      // If server didn’t provide ok/status consistently, normalize basic failure
      if (!res.ok && !data?.status) {
        setResult({ ok: false, error: (data as any)?.error || "Failed to redeem", status: "CONFLICT" });
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setResult({ ok: false, status: "CONFLICT", error: e?.message || "Network error" });
    } finally {
      setSubmitting(false);
      // keep input for retry if failure; clear on success
    }
  }

  // Enter-to-submit
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if (canSubmit) confirmNow();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSubmit, text]);

  const isOk = result?.ok === true && result?.status === "REDEEMED";
  const isBad = result && !isOk;

  const badge = (() => {
    if (!result) return null;
    if (isOk) return { title: "✅ REDEEMED", tone: "ok" as const };
    const status = (result as ConfirmBad).status || "CONFLICT";
    if (status === "EXPIRED") return { title: "⏱ EXPIRED", tone: "bad" as const };
    if (status === "ALREADY_REDEEMED") return { title: "⚠️ ALREADY REDEEMED", tone: "bad" as const };
    if (status === "SOLD_OUT") return { title: "🚫 SOLD OUT", tone: "bad" as const };
    return { title: "❌ NOT VALID", tone: "bad" as const };
  })();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Merchant Redeem</h1>
        <p className="mt-1 text-sm text-slate-600">
          Paste the customer code (or link), then confirm redemption.
          <span className="ml-2 text-xs text-slate-400">Tip: Ctrl/⌘ + Enter to redeem</span>
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Paste short code / link / QR text
        </label>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Example: "A1B2C3" or "https://yourdomain.com/redeem/A1B2C3"'
          rows={3}
          className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={confirmNow}
            disabled={!canSubmit}
            className={[
              "rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition",
              canSubmit
                ? "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99]"
                : "bg-slate-200 text-slate-500 cursor-not-allowed",
            ].join(" ")}
          >
            {submitting ? "Checking…" : "Confirm redemption"}
          </button>

          <button
            type="button"
            onClick={() => {
              setText("");
              setResult(null);
            }}
            disabled={submitting}
            className={[
              "rounded-full px-5 py-2 text-sm font-semibold transition",
              submitting
                ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            Clear
          </button>
        </div>
      </section>

      {/* BIG RESULT PANEL */}
      {result && (
        <section
          className={[
            "mt-6 overflow-hidden rounded-3xl border shadow-sm",
            isOk ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50",
          ].join(" ")}
        >
          <div className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Result
                </p>

                <h2
                  className={[
                    "mt-1 text-2xl font-bold",
                    isOk ? "text-emerald-900" : "text-red-900",
                  ].join(" ")}
                >
                  {badge?.title}
                </h2>

                <p className="mt-2 text-sm text-slate-700">
                  {isOk
                    ? result.message || "Redemption successful."
                    : (result as ConfirmBad).error || "Could not redeem this code."}
                </p>

                {(result as ConfirmBad)?.redeemedAt && !isOk && (
                  <p className="mt-2 text-sm text-slate-700">
                    Redeemed at:{" "}
                    <span className="font-semibold">{prettyTime((result as ConfirmBad).redeemedAt)}</span>
                  </p>
                )}
              </div>

              <div
                className={[
                  "flex h-14 w-14 items-center justify-center rounded-2xl text-3xl font-bold",
                  isOk ? "bg-emerald-600 text-white" : "bg-red-600 text-white",
                ].join(" ")}
              >
                {isOk ? "✓" : "✗"}
              </div>
            </div>

            {/* Extra details on success */}
            {isOk && (
              <div className="mt-5 rounded-2xl bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Deal
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {result.deal?.title || "Deal"}
                </p>
                {result.merchant?.name && (
                  <p className="mt-1 text-sm text-slate-600">
                    Merchant: <span className="font-semibold">{result.merchant.name}</span>
                    {result.merchant.city ? <span className="text-slate-400"> · {result.merchant.city}</span> : null}
                  </p>
                )}
                {result.redemption?.redeemedAt && (
                  <p className="mt-1 text-sm text-slate-600">
                    Time: <span className="font-semibold">{prettyTime(result.redemption.redeemedAt)}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
