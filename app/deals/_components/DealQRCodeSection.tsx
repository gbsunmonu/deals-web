"use client";

import { useState, useTransition } from "react";
import QRCode from "react-qr-code";

type Redemption = {
  id: string;
  code: string;
  shortCode: string;
  redeemedAt?: string | null;
  createdAt?: string;
};

interface Props {
  dealId: string;
}

export default function DealQRCodeSection({ dealId }: Props) {
  const [redemption, setRedemption] = useState<Redemption | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/redemptions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create redemption");
        }

        const data = (await res.json()) as Redemption;
        setRedemption(data);

        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        const url = `${baseUrl}/r/${data.shortCode}`;
        setQrUrl(url);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Something went wrong");
      }
    });
  };

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm text-sm">
      <h2 className="mb-2 text-base font-semibold">Get QR code</h2>

      {!redemption || !qrUrl ? (
        <>
          <p className="mb-3 text-xs text-gray-600">
            Tap the button below to generate a unique QR code for this deal.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
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
            <p className="mb-1 break-all">
              <span className="font-semibold">Link:</span>{" "}
              <span className="font-mono">{qrUrl}</span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
