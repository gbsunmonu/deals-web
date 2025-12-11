"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "react-qr-code";

type Redemption = {
  id: string;
  code: string;
  shortCode: string;
  redeemed: boolean;
  createdAt: string;
};

interface Props {
  dealId: string;
}

export default function DealQRCodeSection({ dealId }: Props) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [redemption, setRedemption] = useState<Redemption | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Create/load a stable device ID in localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    let id = window.localStorage.getItem("coupon_client_id");
    if (!id) {
      if (window.crypto?.randomUUID) {
        id = window.crypto.randomUUID();
      } else {
        id = Math.random().toString(36).slice(2);
      }
      window.localStorage.setItem("coupon_client_id", id);
    }
    setClientId(id);
  }, []);

  const handleGenerate = () => {
    setError(null);

    if (!clientId) {
      setError("Unable to identify this device. Please refresh the page.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/redemptions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId,
            clientId,
          }),
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
            You can only have one QR code for this deal on this device.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-60"
          >
            {isPending ? "Generating..." : "Generate QR code"}
          </button>
          {error && (
            <p className="mt-2 text-xs text-red-600">
              {error}
            </p>
          )}
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

            <p className="mt-3 text-[11px] text-gray-500">
              This QR code is tied to this device. You can&apos;t generate
              another QR code for this deal from the same device.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
