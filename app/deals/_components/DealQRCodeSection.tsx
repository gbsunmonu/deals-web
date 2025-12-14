"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "react-qr-code";

type Redemption = {
  id: string;
  code: string;
  shortCode: string;
  redeemedAt?: string | null;
  createdAt?: string;
  expiresAt?: string;
};

type Availability = {
  ok: true;
  redeemedCount: number;
  left: number | null;
  soldOut: boolean;
  deal: { id: string; title?: string; maxRedemptions: number | null };
};

interface Props {
  dealId: string;
}

export default function DealQRCodeSection({ dealId }: Props) {
  const [redemption, setRedemption] = useState<Redemption | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refreshAvailability() {
    try {
      const res = await fetch(`/api/deals/${dealId}/availability`, { cache: "no-store" });
      const data = (await res.json()) as Availability | any;
      if (res.ok && data?.ok) setAvailability(data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const handleGenerate = () => {
    setError(null);

    startTransition(async () => {
      try {
        // refresh first so UI is accurate
        await refreshAvailability();

        if (availability?.soldOut) {
          setError("Sold out: this deal has been fully redeemed.");
          return;
        }

        const res = await fetch("/api/redemptions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          // SOLD_OUT from API
          if (data?.status === "SOLD_OUT") {
            setError("Sold out: this deal has been fully redeemed.");
            await refreshAvailability();
            return;
          }

          throw new Error(data.error || "Failed to create redemption");
        }

        const r = data as Redemption;
        setRedemption(r);

        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

        const url = `${baseUrl}/r/${r.shortCode}`;
        setQrUrl(url);

        await refreshAvailability();
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Something went wrong");
      }
    });
  };

  const limited =
    typeof availability?.deal?.maxRedemptions === "number" &&
    (availability?.deal?.maxRedemptions ?? 0) > 0;

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-base font-semibold">Get QR code</h2>
          <p className="text-xs text-gray-600">
            Generate a QR code to redeem this deal. QR expires in 15 minutes.
          </p>
        </div>

        {availability?.soldOut ? (
          <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
            Sold out
          </span>
        ) : limited && availability?.left != null ? (
          <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
            {availability.left} left
          </span>
        ) : null}
      </div>

      {limited && availability ? (
        <p className="mt-2 text-[11px] text-gray-500">
          {availability.soldOut
            ? "This deal is fully redeemed."
            : `${availability.redeemedCount} redeemed · ${availability.left ?? 0} remaining`}
        </p>
      ) : null}

      {availability?.soldOut ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          This deal is sold out and can’t be redeemed again.
        </div>
      ) : !redemption || !qrUrl ? (
        <>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending}
              className="inline-flex items-center rounded-md bg-black px-4 py-2 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-60"
            >
              {isPending ? "Generating..." : "Generate QR code"}
            </button>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        </>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-4 md:flex-row md:items-center">
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
            {redemption.expiresAt && (
              <p className="mt-2 text-[11px] text-gray-500">
                Expires at:{" "}
                <span className="font-mono">
                  {new Date(redemption.expiresAt).toLocaleTimeString()}
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
