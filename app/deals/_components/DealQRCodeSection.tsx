"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type Props = {
  dealId: string;
  dealTitle: string;

  // This is the DEAL expiry (endsAt) – NOT the 15-min QR expiry.
  expiresAtIso: string;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DealQRCodeSection({ dealId, dealTitle, expiresAtIso }: Props) {
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

  // ✅ SAFE QR (this is only a link to the QR page, not a redeem code)
  const qrPageUrl = useMemo(() => {
    if (!baseUrl) return "";
    return `${baseUrl}/deals/${dealId}/qr`;
  }, [baseUrl, dealId]);

  const dealEndsAt = useMemo(() => new Date(expiresAtIso), [expiresAtIso]);

  function downloadLinkQrPng() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `deal-qr-link-${dealId}.png`;
    link.click();
  }

  async function copyLink() {
    if (!qrPageUrl) return;
    try {
      await navigator.clipboard.writeText(qrPageUrl);
      alert("QR page link copied ✅");
    } catch {
      alert("Could not copy. Please try again.");
    }
  }

  const whatsappUrl = qrPageUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Open this to generate your 15-minute redeem code: ${qrPageUrl}`
      )}`
    : "";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Your QR code</h2>

      <p className="mt-1 text-xs text-slate-600">
        This QR <span className="font-semibold">opens your QR page</span>.
        The redeem code is generated on that page and{" "}
        <span className="font-semibold">expires in 15 minutes</span>.
      </p>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
        {/* QR on the left */}
        <div className="flex shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-4">
          <QRCodeCanvas
            value={qrPageUrl || " "}
            size={220}
            includeMargin
            ref={qrCanvasRef}
          />
        </div>

        {/* Info + actions on the right */}
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">{dealTitle}</p>

          <p className="mt-1 text-xs text-slate-600">
            Deal valid until{" "}
            <span className="font-semibold">{fmtDate(dealEndsAt)}</span>
          </p>

          <p className="mt-2 text-[11px] text-slate-500">
            To get the redeem code:{" "}
            <span className="font-semibold">open the QR page</span> (it will show a short code like{" "}
            <span className="font-mono">ABC123</span>).
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
                "rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700",
                !qrPageUrl ? "pointer-events-none opacity-60" : "",
              ].join(" ")}
            >
              Open QR page (get code)
            </a>

            <button
              type="button"
              onClick={downloadLinkQrPng}
              disabled={!qrPageUrl}
              className={[
                "rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50",
                !qrPageUrl ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              Download QR link
            </button>

            <button
              type="button"
              onClick={copyLink}
              disabled={!qrPageUrl}
              className={[
                "rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50",
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
                className="rounded-full border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Share QR link (WhatsApp)
              </a>
            )}
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            ✅ If you download this QR, it will still work بعد 2 days because it’s only a link.
            But the <span className="font-semibold">redeem code</span> you generate on the QR page will always expire after 15 minutes.
          </p>
        </div>
      </div>
    </section>
  );
}
