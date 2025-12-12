// components/DealQrSection.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type DealQrSectionProps = {
  dealId: string;
  dealTitle: string;
  expiresAtIso: string;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export default function DealQrSection({
  dealId,
  dealTitle,
  expiresAtIso,
}: DealQrSectionProps) {
  const [shareUrl, setShareUrl] = useState<string>("");
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Build the share URL on the client so it works both locally and on Vercel
  useEffect(() => {
    const base =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : APP_URL || "";
    if (!base) return;

    setShareUrl(`${base}/r/${dealId}`);
  }, [dealId]);

  // QR payload – this is what the QR actually encodes
  const qrPayload = JSON.stringify({
    v: 1,
    d: dealId,
    t: "deal",
  });

  const expiresAt = new Date(expiresAtIso);

  function handleDownloadQr() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `deal-qr-${dealId}.png`;
    link.click();
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard");
    } catch (err) {
      console.error("Copy failed:", err);
      alert("Could not copy link. Please try again.");
    }
  }

  const whatsappUrl = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Show this QR to redeem: ${shareUrl}`
      )}`
    : "";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">QR code for this deal</h2>
      <p className="mt-1 text-xs text-slate-500">
        Show this QR at the merchant to redeem. Each QR can only be used once.
      </p>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
        {/* QR on the left */}
        <div className="flex shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-4">
          <QRCodeCanvas
            value={qrPayload}
            size={220}
            includeMargin
            ref={qrCanvasRef}
          />
        </div>

        {/* Info + actions on the right */}
        <div className="flex-1 text-xs text-slate-600">
          <p className="font-semibold text-slate-900">{dealTitle}</p>
          <p className="mt-1">
            Expires on{" "}
            <span className="font-medium">
              {expiresAt.toLocaleDateString("en-NG", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </p>

          {shareUrl && (
            <p className="mt-2 break-all text-[11px] text-slate-500">
              Direct link: <span className="font-mono">{shareUrl}</span>
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Download QR
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Copy link
            </button>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
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
