// components/DealQrSection.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type DealQrSectionProps = {
  dealId: string;
  dealTitle: string;

  // Deal expiry (endsAt) — only for display
  expiresAtIso: string;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export default function DealQrSection({
  dealId,
  dealTitle,
  expiresAtIso,
}: DealQrSectionProps) {
  const [baseUrl, setBaseUrl] = useState<string>("");
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Build base URL on the client (works on localhost + Vercel)
  useEffect(() => {
    const base =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : APP_URL || "";
    setBaseUrl(base);
  }, []);

  // ✅ SAFE QR: this is just a LINK to the QR page (never expires)
  const qrPageUrl = useMemo(() => {
    if (!baseUrl) return "";
    return `${baseUrl}/deals/${dealId}/qr`;
  }, [baseUrl, dealId]);

  const dealEndsAt = useMemo(() => new Date(expiresAtIso), [expiresAtIso]);

  function handleDownloadLinkQr() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `deal-link-qr-${dealId}.png`;
    link.click();
  }

  async function handleCopyLink() {
    if (!qrPageUrl) return;
    try {
      await navigator.clipboard.writeText(qrPageUrl);
      alert("Link copied to clipboard");
    } catch (err) {
      console.error("Copy failed:", err);
      alert("Could not copy link. Please try again.");
    }
  }

  const whatsappUrl = qrPageUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Open this to generate your redeem QR (expires in 15 mins): ${qrPageUrl}`
      )}`
    : "";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">
        QR link for this deal
      </h2>

      <p className="mt-1 text-xs text-slate-500">
        This QR does <span className="font-semibold">not</span> redeem the deal.
        It opens your QR page where the redeem QR is generated and expires in{" "}
        <span className="font-semibold">15 minutes</span>.
      </p>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
        {/* Link QR */}
        <div className="flex shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-4">
          <QRCodeCanvas
            value={qrPageUrl || " "}
            size={220}
            includeMargin
            ref={qrCanvasRef}
          />
        </div>

        {/* Info + actions */}
        <div className="flex-1 text-xs text-slate-600">
          <p className="font-semibold text-slate-900">{dealTitle}</p>

          <p className="mt-1">
            Deal valid until{" "}
            <span className="font-medium">
              {dealEndsAt.toLocaleDateString("en-NG", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </p>

          {qrPageUrl && (
            <p className="mt-2 break-all text-[11px] text-slate-500">
              QR page link: <span className="font-mono">{qrPageUrl}</span>
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={qrPageUrl || "#"}
              className={[
                "rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700",
                !qrPageUrl ? "pointer-events-none opacity-60" : "",
              ].join(" ")}
            >
              Open QR page
            </a>

            <button
              type="button"
              onClick={handleDownloadLinkQr}
              disabled={!qrPageUrl}
              className={[
                "rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50",
                !qrPageUrl ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              Download link QR
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!qrPageUrl}
              className={[
                "rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50",
                !qrPageUrl ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              Copy QR link
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

          <p className="mt-3 text-[11px] text-slate-500">
            ✅ You can download this QR and use it later — it’s only a link. The
            redeem QR is generated on the QR page and expires in 15 minutes.
          </p>
        </div>
      </div>
    </section>
  );
}
