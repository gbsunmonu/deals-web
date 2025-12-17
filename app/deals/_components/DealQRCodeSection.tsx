"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type Props = {
  dealId: string;
  dealTitle: string;
  merchantName?: string | null;
  endsAtIso: string; // deal endsAt (for “Deal valid until” only)
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export default function DealQRCodeSection({ dealId, dealTitle, merchantName, endsAtIso }: Props) {
  const [baseUrl, setBaseUrl] = useState<string>("");
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Build base URL on client (works on localhost + Vercel)
  useEffect(() => {
    const base =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : APP_URL || "";
    setBaseUrl(base);
  }, []);

  // ✅ SAFE QR: this is a link to the QR page (which generates the real 15-min QR)
  const qrPageUrl = useMemo(() => {
    if (!baseUrl) return "";
    return `${baseUrl}/deals/${dealId}/qr`;
  }, [baseUrl, dealId]);

  const dealEndsAt = useMemo(() => new Date(endsAtIso), [endsAtIso]);

  function downloadLinkQr() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `deal-link-qr-${dealId}.png`;
    link.click();
  }

  async function copyLink() {
    if (!qrPageUrl) return;
    try {
      await navigator.clipboard.writeText(qrPageUrl);
      alert("QR page link copied ✅");
    } catch {
      alert("Could not copy link. Please try again.");
    }
  }

  const whatsappUrl = qrPageUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Open this to generate your QR: ${qrPageUrl}`)}`
    : "";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Your QR code</h2>
      <p className="mt-1 text-xs text-slate-500">
        This QR opens your QR page. The real redeem QR is generated there and expires in 15 minutes.
      </p>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-4">
          <QRCodeCanvas
            value={qrPageUrl || " "}
            size={220}
            includeMargin
            ref={qrCanvasRef}
          />
        </div>

        <div className="flex-1 text-xs text-slate-600">
          <p className="font-semibold text-slate-900">{dealTitle}</p>
          {merchantName ? <p className="mt-1 text-slate-500">at {merchantName}</p> : null}

          <p className="mt-2">
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
              onClick={downloadLinkQr}
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
              onClick={copyLink}
              disabled={!qrPageUrl}
              className={[
                "rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50",
                !qrPageUrl ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
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

          <p className="mt-3 text-[11px] text-slate-500">
            ✅ Downloaded QR stays valid (it’s just a link). The real redeem QR is generated on the QR page and expires in 15 minutes.
          </p>
        </div>
      </div>
    </section>
  );
}
