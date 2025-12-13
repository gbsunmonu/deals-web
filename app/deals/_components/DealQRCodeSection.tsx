"use client";

import { useState, useTransition } from "react";
import QRCode from "react-qr-code";

type Redemption = {
  id: string;
  code: string;
  shortCode: string;
  redeemedAt?: string | null;
};

interface Props {
  dealId: string;
}

export default function DealQRCodeSection({ dealId }: Props) {
  const [redemption, setRedemption] = useState<Redemption | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const generate = () => {
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/redemptions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Failed to create redemption");
        }

        const r = data as Redemption;
        setRedemption(r);

        const url = `${baseUrl}/r/${r.shortCode}`;
        setQrUrl(url);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Something went wrong");
      }
    });
  };

  const clear = () => {
    setError(null);
    setRedemption(null);
    setQrUrl(null);
  };

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm text-sm">
      <h2 className="mb-2 text-base font-semibold">Get QR code</h2>

      <p className="mb-3 text-xs text-gray-600">
        Each QR code is <span className="font-semibold">single-use</span>. If the
        merchant redeems it, generate a new QR code for another redemption
        (until the deal expires).
      </p>

      {!qrUrl || !redemption ? (
        <>
          <button
            type="button"
            onClick={generate}
            disabled={isPending}
            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-60"
          >
            {isPending ? "Generating..." : "Generate QR code"}
          </button>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </>
      ) : (
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="rounded-md bg-white p-3">
            <QRCode value={qrUrl} size={160} />
          </div>

          <div className="text-xs text-gray-700">
            <p className="mb-1">
              <span className="font-semibold">Short code:</span>{" "}
              <span className="font-mono text-sm">{redemption.shortCode}</span>
            </p>
            <p className="mb-3 break-all">
              <span className="font-semibold">Link:</span>{" "}
              <span className="font-mono">{qrUrl}</span>
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generate}
                disabled={isPending}
                className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {isPending ? "Generating..." : "Generate another QR"}
              </button>

              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center rounded-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
