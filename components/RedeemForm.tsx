"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RedeemResponse =
  | {
      ok: true;
      status: "REDEEMED";
      message?: string;
      deal?: { id: string; title?: string };
      merchant?: { id: string; name?: string };
      redemption?: { id: string; redeemedAt?: string };
    }
  | {
      ok?: false;
      status?: string;
      error?: string;
      redeemedAt?: string;
    };

function prettifyTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RedeemForm() {
  const router = useRouter();

  const [text, setText] = useState("");
  const [scanInfo, setScanInfo] = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const canRedeem = useMemo(() => text.trim().length > 0 && !isSubmitting, [
    text,
    isSubmitting,
  ]);

  async function redeemNow() {
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = text.trim();
    if (!payload) {
      setErrorMsg("Paste a QR code value first.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Send scanned text / URL / JSON into confirm endpoint
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrText: payload }),
      });

      const data = (await res.json().catch(() => ({}))) as RedeemResponse;

      if (res.ok && (data as any)?.ok) {
        const dealTitle = (data as any)?.deal?.title;
        const redeemedAt = (data as any)?.redemption?.redeemedAt;

        setSuccessMsg(
          dealTitle
            ? `✅ Redeemed successfully: ${dealTitle}${
                redeemedAt ? ` • ${prettifyTime(redeemedAt)}` : ""
              }`
            : `✅ Redeemed successfully${
                redeemedAt ? ` • ${prettifyTime(redeemedAt)}` : ""
              }`
        );

        // Clear the input so merchant doesn't accidentally re-submit same code
        setText("");
        setScanInfo(null);

        // Refresh server-rendered table data
        router.refresh();
        return;
      }

      // Not OK (or ok:false)
      const status = (data as any)?.status;
      const err = (data as any)?.error || "Failed to redeem. Try again.";

      if (status === "ALREADY_REDEEMED" || res.status === 409) {
        setErrorMsg("This QR code has already been redeemed.");
      } else if (res.status === 404) {
        setErrorMsg("Redemption code not found. Please rescan the QR.");
      } else {
        setErrorMsg(err);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Network error redeeming QR code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function onTextChange(v: string) {
    setText(v);
    setErrorMsg(null);
    setSuccessMsg(null);
    setScanInfo(v.trim() ? "QR code scanned. You can now redeem." : null);
  }

  async function scanWithCamera() {
    // Minimal, safe approach: if BarcodeDetector isn't supported, tell user to paste.
    try {
      const anyWindow = window as any;
      if (!("mediaDevices" in navigator) || !anyWindow.BarcodeDetector) {
        setErrorMsg(
          "Camera scanning is not supported on this device/browser. Please paste the scanned QR text."
        );
        return;
      }

      setErrorMsg(null);
      setSuccessMsg(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      const video = document.createElement("video");
      video.setAttribute("playsinline", "true");
      video.srcObject = stream;
      await video.play();

      const detector = new anyWindow.BarcodeDetector({
        formats: ["qr_code"],
      });

      // Try scanning for up to ~8 seconds
      const start = Date.now();
      const timeoutMs = 8000;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const tick = async () => {
        if (!ctx) return;

        const elapsed = Date.now() - start;
        if (elapsed > timeoutMs) {
          stream.getTracks().forEach((t) => t.stop());
          setErrorMsg("Could not detect a QR code. Please try again or paste it.");
          return;
        }

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const bitmap = await createImageBitmap(canvas);
        const codes = await detector.detect(bitmap);

        if (codes?.length) {
          stream.getTracks().forEach((t) => t.stop());
          const value = codes[0]?.rawValue || "";
          onTextChange(value);
          return;
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    } catch (e: any) {
      setErrorMsg(e?.message || "Camera scanning failed. Please paste the QR text.");
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Redeem a QR code</h2>
      <p className="mt-1 text-xs text-gray-500">
        Scan the customer&apos;s QR code, or paste the scanned text here. Then
        click <span className="font-semibold">Redeem</span>.
      </p>

      <div className="mt-3">
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Paste scanned QR text or URL here..."
          className="w-full rounded-xl border border-gray-200 p-3 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-gray-200"
          rows={3}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={redeemNow}
          disabled={!canRedeem}
          className="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "Redeeming..." : "Redeem"}
        </button>

        <button
          type="button"
          onClick={scanWithCamera}
          className="rounded-full border border-gray-200 px-5 py-2 text-xs font-semibold text-gray-900"
        >
          📷 Scan with camera
        </button>
      </div>

      {scanInfo && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {scanInfo}
        </div>
      )}

      {successMsg && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
