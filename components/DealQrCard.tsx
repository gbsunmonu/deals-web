// deals-web/components/DealQrCard.tsx
"use client";

import { useMemo, useState } from "react";

type Props = {
  id: string;
  title: string;
  merchantName?: string;
  endsAtIso: string;
};

export default function DealQrCard({
  id,
  title,
  merchantName,
  endsAtIso,
}: Props) {
  const [copied, setCopied] = useState(false);

  const { payload, qrUrl, expiryLabel } = useMemo(() => {
    const expiresAt = new Date(endsAtIso);

    const payloadObj = {
      type: "DEAL",
      dealId: id,
      expiresAt: expiresAt.toISOString(),
    };

    const payload = JSON.stringify(payloadObj);

    // use external QR API so you don't need extra dependencies
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      payload
    )}`;

    const expiryLabel = expiresAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return { payload, qrUrl, expiryLabel };
  }, [id, endsAtIso]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
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
          Show this QR code at checkout. The merchant will scan it or paste the
          code below into their Dealina app.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-center rounded-2xl bg-gray-100 p-4">
          {/* QR image */}
          <img
            src={qrUrl}
            alt="Deal QR code"
            className="h-56 w-56 rounded-lg bg-white"
          />
        </div>

        <p className="text-[11px] text-gray-500">
          Valid until <span className="font-semibold">{expiryLabel}</span>.
          Each QR code can only be redeemed once.
        </p>

        {/* Raw payload for no-camera merchants */}
        <div className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="mb-1 text-[11px] font-semibold text-gray-700">
            No camera? Paste this into the Redeem box:
          </p>
          <pre className="max-h-24 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-white px-2 py-1 text-[11px] text-gray-800">
            {payload}
          </pre>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-gray-300 px-3 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
            >
              {copied ? "Copied ✓" : "Copy code"}
            </button>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-gray-400">
          Keep this page open while you&apos;re at the counter. Do not share
          your QR code publicly.
        </p>
      </div>
    </div>
  );
}
