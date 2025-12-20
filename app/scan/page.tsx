"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from "@zxing/browser";
import type { Result } from "@zxing/library";

// Try to extract our deal code from either a bare code or a full URL
function extractCodeFromUrl(text: string): string | null {
  // Example QR payloads we want to support:
  //  - "J7YQR"
  //  - "https://yourdomain.com/r/J7YQR"
  //  - "https://yestodeals.com/r/J7YQR?x=1"


  const trimmed = text.trim();

  // Case 1: looks like a short code already
  if (/^[A-Z0-9]{4,10}$/i.test(trimmed)) {
    return trimmed;
  }

  // Case 2: try to parse as URL and grab last path segment
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /^[A-Z0-9]{4,10}$/i.test(last)) {
      return last;
    }
  } catch {
    // not a URL, ignore
  }

  return null;
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<IScannerControls | null>(null);

  const [isScanning, setIsScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  useEffect(() => {
    // Guard: only run in browser and when we have a video element
    if (!isScanning || !videoRef.current) return;

    const codeReader = new BrowserMultiFormatReader();

    codeReader
      .decodeFromVideoDevice(
        undefined, // ✅ instead of null
        videoRef.current,
        (result: Result | undefined, err) => {
          if (result) {
            const text = result.getText();
            const code = extractCodeFromUrl(text);

            setLastResult(text);

            if (code) {
              setDetectedCode(code);
              setIsScanning(false); // stop scanning
            }
          }

          if (err) {
            // Don’t spam errors for every frame; only show fatal errors
            const name = (err as any)?.name;
            if (name && name !== "NotFoundException") {
              console.warn("Scanner error:", err);
            }
          }
        }
      )
      .then((controls) => {
        scannerRef.current = controls;
      })
      .catch((err) => {
        console.error("Error starting scanner:", err);
        setError("Unable to access camera. Please allow camera permission.");
        setIsScanning(false);
      });

    return () => {
      scannerRef.current?.stop();
      scannerRef.current = null;
    };
  }, [isScanning]);

  function handleRestart() {
    setDetectedCode(null);
    setLastResult(null);
    setError(null);
    setIsScanning(true);
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">
          Merchant
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Scan customer QR
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Point your camera at the customer&apos;s QR code to verify their deal.
        </p>
      </header>

      {/* Camera box */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-black/90 shadow-sm">
        <div className="relative aspect-[3/4] w-full">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
          />

          {/* Overlay frame */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-3xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]" />
          </div>
        </div>
      </section>

      {/* Status + result panel */}
      <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {!error && (
          <p className="text-xs text-slate-500">
            {isScanning
              ? "Scanning… Hold the QR code inside the frame."
              : detectedCode
              ? "Code detected. Use the button below to open the deal details."
              : "Scanner stopped. You can restart scanning if needed."}
          </p>
        )}

        {lastResult && (
          <div className="rounded-2xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <p className="font-semibold text-slate-800">Raw scan text</p>
            <p className="mt-1 break-words font-mono text-[11px]">
              {lastResult}
            </p>
          </div>
        )}

        {detectedCode && (
          <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Detected code
            </p>
            <p className="mt-1 font-mono text-sm font-semibold">
              {detectedCode}
            </p>
            <p className="mt-1 text-[11px]">
              Tap the button below to open the deal / redemption page.
            </p>
            <a
              href={`/r/${encodeURIComponent(detectedCode)}`}
              className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Open deal details
            </a>
          </div>
        )}

        <div className="flex justify-between pt-1">
          <button
            type="button"
            onClick={handleRestart}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Restart scan
          </button>
        </div>
      </section>
    </main>
  );
}
