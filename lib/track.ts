// lib/track.ts
"use client";

export type TrackEventType =
  | "EXPLORE_VIEW"
  | "EXPLORE_SEARCH"
  | "DEAL_VIEW"
  | "DEAL_REDEEM_CLICK"
  | "DEAL_REDEEM_SUCCESS"
  | "MERCHANT_PROFILE_VIEW";

export type TrackEventInput = {
  type: TrackEventType;

  // optional routing/context
  path?: string;

  // optional targets
  dealId?: string | null;
  merchantId?: string | null;

  // optional metadata
  meta?: Record<string, any>;

  /**
   * ✅ If true, server will dedupe using dayKey (visitor/day/type/target).
   * If false/undefined, server still dedupes if your DB has unique dayKey,
   * but this flag can help you decide client behavior later.
   */
  dedupe?: boolean;
};

export async function trackEvent(input: TrackEventInput) {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch {
    // tracking must never break UI
  }
}
