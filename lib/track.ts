export type TrackEventType =
  | "EXPLORE_VIEW"
  | "EXPLORE_SEARCH"
  | "DEAL_VIEW"
  | "DEAL_REDEEM_CLICK"
  | "DEAL_REDEEM_SUCCESS"
  | "MERCHANT_PROFILE_VIEW"
  | "WHATSAPP_CLICK";

export type TrackEventInput = {
  type: TrackEventType;
  path?: string;
  dealId?: string;
  merchantId?: string;
  city?: string;
  dedupe?: boolean;
  meta?: Record<string, any>;
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
