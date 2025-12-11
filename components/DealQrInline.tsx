"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type DealQrInlineProps = {
  dealId: string;
  dealTitle: string;
  expiresAtIso: string;
};

// Deterministic date formatting (no locale mismatch)
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getDate().toString().padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export default function DealQrInline({
  dealId,
  dealTitle,
  expiresAtIso,
}: DealQrInlineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 🔐 QR payload – this is what the merchant scanner will read
  const qrPayload = JSON.stringify({
    type: "DEAL",
    dealId,
    expiresAt: expiresAtIso,
  });

  // ✅ Hydration-safe share URL (computed on client only)
  const [shareUrl, setShareUrl] = useState<string>("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/deals/${dealId}`);
    }
  }, [dealId]);

  // WhatsApp share link (only when shareUrl is ready)
  const whatsappUrl =
    shareUrl &&
    `https://wa.me/?text=${encodeURIComponent(
      `Check out this Dealina deal "${dealTitle}". Show this QR at the store to redeem: ${shareUrl}`
    )}`;

  function handleDownloadQr() {
    if (!canvasRef.current) return;
    try {
      const url = canvasRef.current.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `deal-${dealId}.png`;
      link.click();
    } catch (err) {
      console.error("Error downloading QR:", err);
      alert("Could not download QR image. Please try again.");
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Your QR code</h2>
      <p className="mt-1 text-xs text-slate-500">
        Show this QR at the store when you want to use this deal. The merchant
        will scan it once and mark it as used.
      </p>

      <div className="mt-4 flex gap-4">
        {/* QR block */}
        <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-slate-50 p-2">
          <QRCodeCanvas
            value={qrPayload}
            size={148}
            includeMargin
            ref={canvasRef}
          />
        </div>

        {/* Text + actions */}
        <div className="flex-1 text-xs text-slate-600">
          <p className="line-clamp-2 font-semibold text-slate-900">
            {dealTitle}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Expires on{" "}
            <span className="font-medium text-slate-800">
              {formatDate(expiresAtIso)}
            </span>
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Download QR
            </button>

            {/* Open deal page (for sharing or checking details) */}
            {shareUrl && (
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open deal page
              </a>
            )}

            {/* WhatsApp share */}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-emerald-200 px-4 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Share via WhatsApp
              </a>
            )}
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            Do not share this code after you&apos;ve used it. Each QR can only
            be redeemed one time.
          </p>
        </div>
      </div>
    </section>
  );
}
