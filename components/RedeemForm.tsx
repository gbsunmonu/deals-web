// components/RedeemForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

type RedeemSuccess = {
  id: string;
  title: string;
  originalPrice: number | null;
  discountValue: number;
};

function formatCurrency(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return "-";
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default function RedeemForm() {
  const [payload, setPayload] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [successDeal, setSuccessDeal] = useState<RedeemSuccess | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  // ---- Stop camera + reader (defensive) ----
  const stopScanner = () => {
    try {
      const reader = readerRef.current;

      // Only call reset if it exists
      if (reader && typeof (reader as any).reset === "function") {
        (reader as any).reset();
      }

      readerRef.current = null;

      const video = videoRef.current;
      if (video && video.srcObject instanceof MediaStream) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
    } catch (err) {
      console.error("Error while stopping scanner:", err);
    } finally {
      setScanning(false);
    }
  };

  // ---- Start scanning ----
  const startScanner = async () => {
    setError(null);
    setStatus(null);
    setSuccessDeal(null);
    setScanning(true);

    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const videoInputDevices =
        await BrowserMultiFormatReader.listVideoInputDevices();

      const deviceId = videoInputDevices[0]?.deviceId ?? undefined; // first camera

      await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        (result, err) => {
          if (result) {
            const text = result.getText();
            setPayload(text);
            setStatus("QR code scanned. You can now redeem.");
            setSuccessDeal(null);
            stopScanner();
          }
          // ignore errors while scanning
        }
      );
    } catch (err) {
      console.error("Scanner error:", err);
      setError("Unable to access camera. Check browser permissions.");
      stopScanner();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setSuccessDeal(null);

    const trimmed = payload.trim();
    if (!trimmed) {
      setError("Paste or scan a QR code first.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to redeem QR code.");
      } else {
        setStatus(
          data?.message || "Redemption successful. Customer discount applied."
        );
        setPayload("");

        if (data?.deal) {
          setSuccessDeal({
            id: data.deal.id,
            title: data.deal.title,
            originalPrice: data.deal.originalPrice ?? null,
            discountValue: data.deal.discountValue ?? 0,
          });
        }
      }
    } catch (err) {
      console.error("Redeem error:", err);
      setError("Network error redeeming QR code.");
    } finally {
      setLoading(false);
    }
  }

  // ---- Pricing summary for successful redemption ----
  let summary: {
    original: number | null;
    final: number | null;
    savings: number | null;
    discount: number;
  } | null = null;

  if (successDeal) {
    const original = successDeal.originalPrice ?? null;
    const discount = successDeal.discountValue ?? 0;
    let final: number | null = null;
    let savings: number | null = null;

    if (original && discount > 0) {
      final = Math.round((original * (100 - discount)) / 100);
      savings = original - final;
    }

    summary = { original, final, savings, discount };
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-gray-200 bg-white px-4 py-5 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-gray-900">
          Redeem a QR code
        </h2>
        <p className="text-xs text-gray-500">
          Scan the customer&apos;s QR code, or paste the scanned text here.
          Then click <span className="font-semibold">Redeem</span>.
        </p>

        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
          placeholder='Paste something like: {"type":"DEAL","dealId":"...","expiresAt":"..."}'
        />

        {/* Scanner controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-black/90 disabled:opacity-60"
          >
            {loading ? "Redeeming..." : "Redeem"}
          </button>

          {!scanning ? (
            <button
              type="button"
              onClick={startScanner}
              className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              📷 Scan with camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopScanner}
              className="rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Stop scanning
            </button>
          )}
        </div>

        {/* Camera preview */}
        {scanning && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-black/80 p-2">
            <p className="mb-1 text-[11px] text-gray-200">
              Point the camera at the customer&apos;s QR code…
            </p>
            <video
              ref={videoRef}
              className="h-52 w-full rounded-lg bg-black object-cover"
            />
          </div>
        )}

        {status && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {status}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </form>

      {/* SUCCESS SUMMARY CARD */}
      {successDeal && summary && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">
              ✓
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Redemption successful
              </p>
              <p className="text-[11px] text-emerald-900/80">
                Share this with the customer so they know the discount was
                applied.
              </p>
            </div>
          </div>

          <div className="mt-2 border-t border-emerald-100 pt-3 text-xs text-emerald-900">
            <p className="font-semibold">{successDeal.title}</p>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-medium">Original price:</span>{" "}
                {formatCurrency(summary.original)}
              </p>
              <p>
                <span className="font-medium">Discount:</span>{" "}
                {summary.discount}% off
              </p>
              <p>
                <span className="font-medium">Customer pays:</span>{" "}
                {formatCurrency(summary.final)}
              </p>
              <p>
                <span className="font-medium">Customer saved:</span>{" "}
                {formatCurrency(summary.savings)}
              </p>
            </div>

            <p className="mt-2 text-[11px] text-emerald-900/80">
              Time: just now • Code is now marked as used and can&apos;t be
              redeemed again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
