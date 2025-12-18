// components/DealQrInline.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type Props = {
  dealId: string;
  dealTitle: string;

  // ✅ accept either prop name so we don't break existing pages
  expiresAtIso?: string; // what your page currently passes
  endsAtIso?: string; // optional newer name
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export default function DealQrInline({
  dealId,
  dealTitle,
  expiresAtIso,
  endsAtIso,
}: Props) {
  const [baseUrl, setBaseUrl] = useState<string>("");
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  // Build base URL on the client (works on localhost + Vercel)
  useEffect(() => {
    const base =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : APP_URL || "";
    setBaseUrl(base);
  }, []);

  // ✅ SAFE QR: opens the QR page which generates the 15-min redeem QR
  const qrPageUrl = useMemo(() => {
    if (!baseUrl) return "";
    return `${baseUrl}/deals/${dealId}/qr`;
  }, [baseUrl, dealId]);

  const dealEndsAtIso = endsAtIso || expiresAtIso || "";
  const dealEndsAt = useMemo(
    () => (dealEndsAtIso ? new Date(dealEndsAtIso) : null),
    [dealEndsAtIso]
  );

  function handleDownloadLinkQr() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `deal-qr-link-${dealId}.png`;
    link.click();
  }

  async function handleCopyLink() {
    if (!qrPageUrl) return;
    try {
      await navigator.clipboard.writeText(qrPageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const whatsappUrl = qrPageUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Open this at checkout to generate your redeem QR: ${qrPageUrl}`
      )}`
    : "";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Your QR link</h2>

      <p className="mt-1 text-xs text-slate-500">
        This QR is a <span className="font-semibold">link</span>. Open it at the
        counter to generate a <span className="font-semibold">15-minute redeem QR</span>.
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

          {dealEndsAt ? (
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
          ) : null}

          {qrPageUrl && (
            <p className="mt-2 break-all text-[11px] text-slate-500">
              Link: <span className="font-mono">{qrPageUrl}</span>
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
              Download QR link
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
              {copied ? "Copied ✓" : "Copy link"}
            </button>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Share on WhatsApp
              </a>
            )}
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            ✅ Downloaded QR stays valid because it’s only a link. The redeem QR is generated on the QR page and expires in 15 minutes.
          </p>
        </div>
      </div>
    </section>
  );
}
