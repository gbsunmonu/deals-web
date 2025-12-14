"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";

type RedeemResponse =
  | {
      ok: true;
      status: "REDEEMED";
      message?: string;
      redemption?: { id: string; redeemedAt: string };
      deal?: { title?: string };
      merchant?: { name?: string };
    }
  | {
      ok?: false;
      status?: "ALREADY_REDEEMED" | "SOLD_OUT";
      error?: string;
      redeemedAt?: string;
      details?: string;
    }
  | { error?: string; details?: string };

export default function RedeemForm() {
  const [qrText, setQrText] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "success"; message: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const [isPending, startTransition] = useTransition();

  // Camera scanning
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  async function stopScanner() {
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;

    // Extra safety: stop any active stream tracks
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    }
  }

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearAll() {
    setQrText("");
    setStatus({ type: "idle" });
  }

  function redeem(textOverride?: string) {
    const payload = (textOverride ?? qrText).trim();
    if (!payload) {
      setStatus({ type: "error", message: "Paste or scan a QR code first." });
      return;
    }

    setStatus({ type: "idle" });

    startTransition(async () => {
      try {
        const res = await fetch("/api/redemptions/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrText: payload }),
        });

        const data = (await res.json().catch(() => ({}))) as RedeemResponse;

        if (!res.ok) {
          const msg =
            (data as any)?.error ||
            (data as any)?.details ||
            "Failed to redeem.";
          setStatus({ type: "error", message: msg });

          // On failure, do NOT clear input (so user can retry/copy)
          return;
        }

        // Success
        const successMsg =
          (data as any)?.message ||
          `Redeemed successfully${(data as any)?.deal?.title ? `: ${(data as any).deal.title}` : ""}.`;

        setStatus({ type: "success", message: successMsg });

        // ✅ prevent double-redeem confusion
        setQrText("");
      } catch (err: any) {
        setStatus({
          type: "error",
          message: err?.message || "Something went wrong redeeming the QR.",
        });
      }
    });
  }

  async function startCameraScan() {
    setStatus({ type: "idle" });

    // Basic browser support
    if (!navigator?.mediaDevices?.getUserMedia) {
      setStatus({
        type: "error",
        message: "Camera not supported in this browser.",
      });
      return;
    }

    setIsScanning(true);

    try {
      const reader = new BrowserQRCodeReader();

      // Prefer back camera when available (mobile)
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      const preferred =
        devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ||
        devices[0]?.deviceId;

      if (!videoRef.current) {
        setStatus({ type: "error", message: "Camera UI not ready." });
        setIsScanning(false);
        return;
      }

      // Start decoding
      controlsRef.current = await reader.decodeFromVideoDevice(
        preferred || undefined,
        videoRef.current,
        (result, error, controls) => {
          if (result) {
            const text = result.getText();
            setQrText(text);
            setIsScanning(false);

            // Stop camera immediately once we get a result
            try {
              controls.stop();
            } catch {}
            stopScanner();

            // Auto-redeem after scan (you can change this behavior if you want)
            redeem(text);
          }
        }
      );
    } catch (err: any) {
      await stopScanner();
      setIsScanning(false);
      setStatus({
        type: "error",
        message:
          err?.message ||
          "Could not open camera. Check permissions and try again.",
      });
    }
  }

  async function cancelScan() {
    await stopScanner();
    setIsScanning(false);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Redeem customer QR</h2>
      <p className="mt-1 text-xs text-gray-500">
        Paste the scanned QR text / link / short code and redeem it. After
        success, the input clears to prevent double-redemption.
      </p>

      <div className="mt-3">
        <textarea
          value={qrText}
          onChange={(e) => setQrText(e.target.value)}
          placeholder="Paste scanned QR text / URL / short code here..."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          rows={4}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => redeem()}
          disabled={isPending || isScanning}
          className="inline-flex items-center rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-gray-900 disabled:opacity-60"
        >
          {isPending ? "Redeeming..." : "Redeem"}
        </button>

        <button
          type="button"
          onClick={clearAll}
          disabled={isPending || isScanning}
          className="inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={startCameraScan}
          disabled={isPending || isScanning}
          className="inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Scan with camera
        </button>
      </div>

      {/* Status */}
      {status.type === "success" && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          ✅ {status.message}
        </div>
      )}

      {status.type === "error" && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {status.message}
        </div>
      )}

      {/* Camera modal */}
      {isScanning && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-700">
              Scanning… point the camera at the QR code
            </p>
            <button
              type="button"
              onClick={cancelScan}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-black">
            <video
              ref={videoRef}
              className="h-72 w-full object-cover"
              muted
              playsInline
              autoPlay
            />
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            If the camera doesn’t open, allow camera permission for this site.
          </p>
        </div>
      )}
    </div>
  );
}
