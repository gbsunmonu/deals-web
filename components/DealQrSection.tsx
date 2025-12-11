// components/DealQrSection.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode.react";

type DealQrSectionProps = {
  dealId: string;
  dealTitle: string;
  // ISO string from server: deal.endsAt.toISOString()
  expiresAt: string;
};

function formatExpires(expiresAt: string) {
  if (!expiresAt) return "";
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DealQrSection({
  dealId,
  dealTitle,
  expiresAt,
}: DealQrSectionProps) {
  const [shareUrl, setShareUrl] = useState("");
  const [expiresLabel] = useState(() => formatExpires(expiresAt));

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Hydration-safe: set share URL only on the client
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/deals/${dealId}`);
    }
  }, [dealId]);

  const whatsappUrl =
    shareUrl &&
    `https://wa.me/?text=${encodeURIComponent(
      `Check out this Dealina deal and show the QR at the store:\n${shareUrl}`
    )}`;

  const qrPayload = JSON.stringify({
    type: "DEAL",
    dealId,
    expiresAt,
  });

  function handleDownloadQr() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${dealTitle || "deal"}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("QR download error:", err);
      alert("Sorry, we couldn't download the QR image.");
    }
  }

  async function handleShareDeal() {
    if (!shareUrl) return;

    const message = `Check out this Dealina deal and show the QR at the store:\n${shareUrl}`;

    // Native share if available
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "Dealina deal",
          text: message,
          url: shareUrl,
        });
        return;
      } catch (err) {
        console.warn("navigator.share failed, falling back:", err);
      }
    }

    // Clipboard fallback
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Deal link copied. You can paste it into WhatsApp or SMS.");
        return;
      } catch (err) {
        console.warn("Clipboard copy failed:", err);
      }
    }

    // Last fallback
    alert(message);
  }

  return (
    <section className="mt-6 rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Your QR code</h2>
      <p className="mt-1 text-xs text-gray-500">
        Show this code at checkout to get your discount. Each code can only be
        used once.
      </p>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
        {/* QR block */}
        <div className="flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-4">
          <div className="rounded-xl bg-white p-3">
            <QRCode
              value={qrPayload}
              size={220}
              renderAs="canvas"
              includeMargin
              ref={qrCanvasRef}
            />
          </div>
        </div>

        {/* Text + actions */}
        <div className="flex-1 text-sm text-gray-800">
          <p className="text-sm font-semibold text-gray-900 line-clamp-2">
            {dealTitle}
          </p>

          <p className="mt-1 text-xs text-gray-600">
            You don&apos;t need an account. Just{" "}
            <span className="font-semibold">download or save this QR</span> and
            show it at the store to get your discount.
          </p>

          {expiresLabel && (
            <p className="mt-1 text-[11px] text-gray-500">
              Valid until <span className="font-medium">{expiresLabel}</span>.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-black/90"
            >
              Download QR code
            </button>

            <button
              type="button"
              onClick={handleShareDeal}
              className="text-[11px] font-semibold text-emerald-700 underline-offset-2 hover:underline"
            >
              Share deal link
            </button>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-emerald-700 underline-offset-2 hover:underline"
              >
                Share via WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
