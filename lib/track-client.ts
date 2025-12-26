type TrackInput = {
  type:
    | "EXPLORE_VIEW"
    | "EXPLORE_SEARCH"
    | "DEAL_VIEW"
    | "DEAL_REDEEM_CLICK"
    | "DEAL_REDEEM_SUCCESS"
    | "MERCHANT_PROFILE_VIEW";
  path?: string;
  dealId?: string;
  merchantId?: string;
  city?: string;
};

export async function track(input: TrackInput) {
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
