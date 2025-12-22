"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import type { Result } from "@zxing/library";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (shortCode: string) => void | Promise<void>;
};

function clampCode(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isCodeLike(s: string) {
  return /^[A-Z0-9]{4,12}$/.test(s);
}

// Extract short code from either:
// - "J7YQR"
// - "https://domain.com/r/J7YQR"
// - "https://domain.com/redeem/J7YQR?x=1"
function extractCodeFromText(text: string): string | null {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  // direct code
  const direct = clampCode(trimmed);
  if (isCodeLike(direct) && /^[A-Z0-9]{4,12}$/i.test(trimmed)) {
    return direct;
  }

  // URL -> last path segment
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    const code = clampCode(last || "");
    if (isCodeLike(code)) return code;
  } catch {
    // not a URL
  }

  return null;
}

export default function ScanShortcodeModal({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [scannedOverlay, setScannedOverlay] = useState(false);
  const [overlayCode, setOverlayCode] = useState<string | null>(null);
  const [lastText, setLastText] = useState<string | null>(null);

  // prevent duplicate triggers
  const lastFireRef = useRef<{ code: string; ts: number } | null>(null);
  const overlayTimerRef = useRef<number | null>(null);

  function clearOverlayTimer() {
    if (overlayTimerRef.current) {
      window.clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
  }

  async function stopScanner() {
    // stop zxing loop
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore
    }
    controlsRef.current = null;

    // stop camera tracks (important on mobile)
    try {
      const v = videoRef.current;
      const stream = v?.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        if (v) v.srcObject = null;
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!open) {
      setError(null);
      setScannedOverlay(false);
      setOverlayCode(null);
      setLastText(null);
      lastFireRef.current = null;
      clearOverlayTimer();
      stopScanner();
      return;
    }

    // reset state each time modal opens
    setError(null);
    setScannedOverlay(false);
    setOverlayCode(null);
    setLastText(null);
    lastFireRef.current = null;

    let cancelled = false;

    async function start() {
      if (!videoRef.current) return;

      try {
        const reader = new BrowserMultiFormatReader();

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          async (result: Result | undefined, err) => {
            if (cancelled) return;

            if (result) {
              const text = result.getText();
              setLastText(text);

              const code = extractCodeFromText(text);
              if (!code) return;

              const now = Date.now();
              const last = lastFireRef.current;
              if (last && last.code === code && now - last.ts < 2500) return;
              lastFireRef.current = { code, ts: now };

              // ✅ show overlay immediately with the code
              setOverlayCode(code);
              setScannedOverlay(true);
              clearOverlayTimer();
              overlayTimerRef.current = window.setTimeout(() => {
                setScannedOverlay(false);
              }, 650);

              // stop scanning so it doesn't keep firing
              await stopScanner();

              // hand code to parent (auto-redeem can happen there)
              await onDetected(code);

              // close modal after a brief pause so cashier sees overlay
              window.setTimeout(() => {
                onClose();
              }, 220);
            }

            if (err) {
              const name = (err as any)?.name;
              if (name && name !== "NotFoundException") {
                // ignore noisy per-frame errors
              }
            }
          }
        );

        controlsRef.current = controls;
      } catch (e: any) {
        console.error("scanner start error:", e);
        setError("Unable to access camera. Please allow camera permission.");
      }
    }

    start();

    return () => {
      cancelled = true;
      clearOverlayTimer();
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Merchant
            </p>
            <p className="text-base font-semibold text-slate-900">
              Scan customer QR
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="p-4">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-black/90 shadow-sm">
            <div className="relative aspect-[3/4] w-full">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay
                muted
                playsInline
              />

              {/* Frame overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-44 w-44 rounded-3xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]" />
              </div>

              {/* ✅ Big SCANNED overlay + show code */}
              {scannedOverlay ? (
                <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/70 backdrop-blur-[2px]">
                  <div className="w-[88%] max-w-[360px] rounded-3xl bg-white/92 px-6 py-5 text-center shadow-lg">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                      Scanned ✅
                    </p>

                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Short code
                    </p>
                    <p className="mt-1 font-mono text-4xl font-extrabold tracking-widest text-slate-900">
                      {overlayCode || "—"}
                    </p>

                    <p className="mt-2 text-xs text-slate-600">
                      Processing redemption…
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {error ? (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-600">
              Hold the QR inside the square. It will auto-redeem.
            </p>
          )}

          {lastText ? (
            <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <p className="font-semibold text-slate-800">Raw scan text</p>
              <p className="mt-1 break-words font-mono">{lastText}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
