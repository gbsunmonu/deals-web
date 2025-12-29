"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/track";

export default function GetRedeemQrButton({
  dealId,
  merchantId,
}: {
  dealId: string;
  merchantId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setErr(null);

    trackEvent({
      type: "DEAL_REDEEM_CLICK",
      dedupe: false,
      dealId,
      merchantId,
      meta: { source: "deal_page_cta" },
    });

    setLoading(true);
    try {
      // TODO: replace with your real endpoint that creates the QR / redemption
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(data?.error || "Could not generate QR.");
        return;
      }

      // expect something like { qrUrl: "..." }
      const url = typeof data?.qrUrl === "string" ? data.qrUrl : null;
      setQrUrl(url);

      trackEvent({
        type: "DEAL_REDEEM_SUCCESS",
        dedupe: false,
        dealId,
        merchantId,
        meta: { source: "deal_page_cta" },
      });
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={[
          "rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition",
          loading
            ? "bg-slate-200 text-slate-600"
            : "bg-emerald-600 text-white hover:bg-emerald-700",
        ].join(" ")}
      >
        {loading ? "Generating…" : "Get QR / Claim deal →"}
      </button>

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      {qrUrl ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Your QR</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR code" className="mt-3 w-48" />
        </div>
      ) : null}
    </div>
  );
}
