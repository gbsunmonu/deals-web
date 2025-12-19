"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";

type Props = {
  dealId: string;
  dealTitle: string;
  expiresAtIso: string; // deal endsAt (NOT the 15-min QR expiry)
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DealQrInline({ dealId, dealTitle, expiresAtIso }: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Build base URL on client (works on localhost + Vercel)
  useEffect(() => {
    const base =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : APP_URL || "";
    setBaseUrl(base);
  }, []);

  // ✅ Safe link QR target
  const qrPagePath = `/deals/${dealId}/qr`;
  const qrPageUrl = useMemo(() => {
    if (!baseUrl) return "";
    return `${baseUrl}${qrPagePath}`;
  }, [baseUrl, qrPagePath]);

  function handleDownloadQr() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `deal-qr-link-${dealId}.png`;
    a.click();
  }

  async function handleCopyLink() {
    if (!qrPageUrl) return;
    try {
      await navigator.clipboard.writeText(qrPageUrl);
      setCopied(true);
      setMenuOpen(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const whatsappUrl = qrPageUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Open this at the counter to generate your redeem QR: ${qrPageUrl}`
      )}`
    : "";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Save this QR (opens your QR at the counter)
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This QR is a link. The <span className="font-semibold">redeem QR</span> appears on the next screen and expires in{" "}
            <span className="font-semibold">15 minutes</span>.
          </p>
        </div>

        <div className="text-left md:text-right">
          <div className="text-sm font-semibold text-slate-900 line-clamp-1">
            {dealTitle}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Deal valid until <span className="font-semibold">{formatDateLabel(expiresAtIso)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr] md:items-center">
        {/* QR image */}
        <div className="flex items-center justify-center rounded-2xl bg-slate-50 p-4">
          <QRCodeCanvas
            value={qrPageUrl || " "}
            size={220}
            includeMargin
            ref={qrCanvasRef}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {/* Primary CTA */}
          <Link
            href={qrPagePath}
            className={[
              "inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition",
              "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99]",
            ].join(" ")}
          >
            Open redeem QR →
          </Link>

          {/* Secondary row */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              More options
              <span className="text-slate-500">▾</span>
            </button>

            {menuOpen && (
              <div
                className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
                role="menu"
              >
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  disabled={!qrPageUrl}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  role="menuitem"
                >
                  Download QR link (image)
                  <div className="mt-0.5 text-xs font-normal text-slate-500">
                    This download stays valid — it opens your QR page.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!qrPageUrl}
                  className="w-full border-t border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  role="menuitem"
                >
                  Copy link
                </button>

                <a
                  href={whatsappUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={[
                    "block w-full border-t border-slate-200 px-4 py-3 text-left text-sm font-semibold",
                    whatsappUrl ? "text-emerald-700 hover:bg-emerald-50" : "text-slate-400 pointer-events-none",
                  ].join(" ")}
                  role="menuitem"
                >
                  Share on WhatsApp
                </a>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="w-full border-t border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50"
                  role="menuitem"
                >
                  Close
                </button>
              </div>
            )}
          </div>

          {/* Small status line */}
          <div className="text-xs text-slate-500">
            {copied ? (
              <span className="inline-flex items-center gap-2 text-emerald-700">
                <span className="text-base">✓</span> Link copied
              </span>
            ) : (
              <span>
                Tip: you can save/share this link QR safely. The redeem QR is generated when opened.
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
