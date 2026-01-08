"use client";

import { trackEvent } from "@/lib/track";

function digitsOnly(input: string) {
  return input.replace(/\D/g, "");
}

// WhatsApp wa.me expects digits only, no "+"
function waMeLink(e164OrDigits: string, text?: string) {
  const digits = digitsOnly(e164OrDigits);
  const base = `https://wa.me/${digits}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export default function WhatsAppButton(props: {
  whatsappNumber?: string | null;
  merchantName: string;
  dealTitle?: string | null;
  dealId?: string;
  merchantId?: string;
  className?: string;
}) {
  const {
    whatsappNumber,
    merchantName,
    dealTitle,
    dealId,
    merchantId,
    className,
  } = props;

  if (!whatsappNumber) return null;

  const message = dealTitle
    ? `Hi ${merchantName}, I’m interested in this deal: "${dealTitle}". Can you help?`
    : `Hi ${merchantName}, I’d like to ask a question.`;

  const href = waMeLink(whatsappNumber, message);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => {
        // Never break UI
        try {
          const fullPath =
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : undefined;

          trackEvent({
            type: "WHATSAPP_CLICK",
            path: fullPath,
            dealId,
            merchantId,
            dedupe: false,
            meta: {
              merchantName,
              dealTitle: dealTitle ?? null,
              whatsapp: whatsappNumber,
            },
          });
        } catch {}
      }}
      className={
        className ??
        "inline-flex items-center rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
      }
      title="Chat on WhatsApp"
    >
      WhatsApp
    </a>
  );
}
