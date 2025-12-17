"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  id: string;
  title: string;
  merchantName?: string;
  endsAtIso: string; // deal end time (server truth)
};

function formatCountdown(ms: number) {
  if (ms <= 0) return "Expired";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DealQrCard({
  id,
  title,
  merchantName,
  endsAtIso,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // ⏱ Tick every second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const {
    payload,
    qrUrl,
    expiresAt,
    isExpired,
    countdownLabel,
    expiryDateLabel,
  } = useMemo(() => {
    const dealEndsAt = new Date(endsAtIso).getTime();

    // ✅ QR expires in 15 minutes OR when deal ends (whichever comes first)
    const qrExpiresAt = Math.min(
      Date.now() + 15 * 60 * 1000,
      dealEndsAt
    );

    const payloadObj = {
      type: "DEAL",
      dealId: id,
      expiresAt: new Date(qrExpiresAt).toISOString(),
    };

    const payload = JSON.stringify(payloadObj);

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      payload
    )}`;

    const isExpired = now >= qrExpiresAt;

    const countdownLabel = isExpired
      ? "Expired"
      : formatCountdown(qrExpiresAt - now);

    const expiryDateLabel = new Date(qrExpiresAt).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      payload,
      qrUrl,
      expiresAt: qrExpiresAt,
      isExpired,
      countdownLabel,
      expiryDateLabel,
    };
  }, [id, endsAtIso, now]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Deal QR code
        </p>
        <h1 className="mt-1 text-lg font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        {merchantName && (
          <p className="mt-1 text-xs text-gray-600">at {merchantName}</p>
        )}
        <p className="mt-1 text-[11px] text-gray-500">
          Show this QR code at checkout. It expires automatically.
        </p>
      </div>

      {/* QR */}
      <div className="flex flex-col items-center gap-4">
        <div
          className={[
            "flex items-center justify-center rounded-2xl p-4",
            isExpired ? "bg-gray-200" : "bg-gray-100",
          ].join(" ")}
        >
          <img
            src={qrUrl}
            alt="Deal QR code"
            className={[
              "h-56 w-56 rounded-lg bg-white transition",
              isExpired ? "opacity-40 blur-[1px]" : "",
            ].join(" ")}
          />
        </div>

        {/* Countdown */}
        <div
          className={[
            "rounded-full px-4 py-1 text-sm font-semibold",
            isExpired
              ? "bg-red-100 text-red-700"
              : "bg-emerald-100 text-emerald-800",
          ].join(" ")}
        >
          {isExpired
            ? "QR expired"
            : `Expires in ${countdownLabel}`}
        </div>

        {/* Info */}
        <p className="text-[11px] text-gray-500 text-center">
          Valid until{" "}
          <span className="font-semibold">{expiryDateLabel}</span>.  
          Each QR can only be redeemed once.
        </p>

        {/* Raw payload fallback */}
        <div className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="mb-1 text-[11px] font-semibold text-gray-700">
            No camera? Paste this into Redeem:
          </p>
          <pre className="max-h-24 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-white px-2 py-1 text-[11px] text-gray-800">
            {payload}
          </pre>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              disabled={isExpired}
              className={[
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                isExpired
                  ? "border-gray-300 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 text-gray-700 hover:bg-gray-100",
              ].join(" ")}
            >
              {copied ? "Copied ✓" : "Copy code"}
            </button>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-gray-400 text-center">
          Keep this page open while at the counter.  
          Do not share your QR publicly.
        </p>
      </div>
    </div>
  );
}
