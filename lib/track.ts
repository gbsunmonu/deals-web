// lib/track.ts
export const TRACK_ENDPOINT = "/api/track";

export type TrackEventType =
  | "EXPLORE_VIEW"
  | "EXPLORE_SEARCH"
  | "DEAL_VIEW"
  | "DEAL_REDEEM_CLICK"
  | "DEAL_REDEEM_SUCCESS"
  | "MERCHANT_PROFILE_VIEW";

export type TrackEventInput = {
  type: TrackEventType;

  dealId?: string;
  merchantId?: string;

  path?: string;
  meta?: Record<string, any>;

  // ✅ optional dedupe (once/day/visitor/type/target/path)
  dedupe?: boolean;
};

export async function trackEvent(input: TrackEventInput) {
  try {
    await fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch {
    // tracking must never break UI
  }
}
