// components/ShareDealActions.tsx
"use client";

import { useState } from "react";

type ShareDealActionsProps = {
  title: string;
  /** Route path for this deal, e.g. `/deals/123` */
  path: string;
};

export default function ShareDealActions({
  title,
  path,
}: ShareDealActionsProps) {
  const [copied, setCopied] = useState(false);

  // Build the full URL on the client (includes domain)
  const getFullUrl = () => {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  };

  async function handleCopy() {
    try {
      const fullUrl = getFullUrl();
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }

  function handleWhatsApp() {
    const fullUrl = getFullUrl();
    const text = encodeURIComponent(
      `${title} — grab this deal on Dealina: ${fullUrl}`
    );
    const url = `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Use native share ONLY on mobile; on desktop just copy the link
  async function handleNativeShare() {
    const fullUrl = getFullUrl();

    const isMobile =
      typeof navigator !== "undefined" &&
      ("maxTouchPoints" in navigator ? navigator.maxTouchPoints > 0 : false);

    const canNativeShare =
      typeof navigator !== "undefined" && (navigator as any).share;

    if (canNativeShare && isMobile) {
      try {
        await (navigator as any).share({
          title,
          url: fullUrl,
        });
        return;
      } catch (err) {
        console.warn("Native share cancelled/failed, falling back to copy:", err);
        // fall through to copy
      }
    }

    // Desktop or no native share → just copy the link instead
    await handleCopy();
  }

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Share this deal</h2>
      <p className="mt-1 text-xs text-gray-500">
        Send this deal to a friend on WhatsApp or copy the link and share
        anywhere.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleWhatsApp}
          className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        >
          💬 Share on WhatsApp
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        >
          {copied ? "✅ Link copied" : "Copy link"}
        </button>

        <button
          type="button"
          onClick={handleNativeShare}
          className="hidden sm:inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        >
          📤 Share…
        </button>
      </div>
    </section>
  );
}
