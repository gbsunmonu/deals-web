"use client";

import { useMemo, useState } from "react";
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

function isOk(r: ConfirmResponse | null): r is ConfirmOk {
  return !!r && (r as any).ok === true;
}

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

  if (status === "EXPIRED") return "This QR code has expired. Ask the customer to generate a new one.";
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

  const statusTone = useMemo(() => {
    if (!result) return null;
    return isOk(result) ? "success" : "error";
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

      if (!res.ok || !isOk(data)) {
        const msg = friendlyErrorMessage(data, res.status);
        setResult({ ...(data as any), ok: false, error: msg });
        return;
      }

      setResult(data);
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
          Scan the customer QR or paste the code. Customer QR expires in 15 minutes.
        </p>
      </header>

      <QrScanner
        onResult={onScan}
        onError={(msg) => setResult({ ok: false, error: msg })}
        paused={submitting}
        dedupeMs={1500}
      />

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

      {result && (
        <section
          className={[
            "rounded-2xl border p-5 shadow-sm",
            statusTone === "success"
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50",
          ].join(" ")}
        >
          {isOk(result) ? (
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white text-xl">
                ✓
              </div>
              <div>
                <p className="text-base font-semibold text-emerald-900">
                  Redeemed successfully
                </p>
                <p className="mt-1 text-sm text-emerald-900/70">
                  {result.message || "This code is now used and cannot be redeemed again."}
                </p>
                {result.redemption?.redeemedAt && (
                  <p className="mt-2 text-[11px] text-emerald-900/60">
                    Time: {new Date(result.redemption.redeemedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-600 text-white text-xl">
                ✗
              </div>
              <div>
                <p className="text-base font-semibold text-red-900">
                  Redemption failed
                </p>
                <p className="mt-1 text-sm text-red-900/70">
                  {result.error || "This code can’t be redeemed."}
                </p>

                {result.status && (
                  <p className="mt-2 text-[11px] text-red-900/60">
                    Status: {result.status}
                  </p>
                )}

                {result.redeemedAt && (
                  <p className="mt-2 text-[11px] text-red-900/60">
                    Redeemed at: {new Date(result.redeemedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
