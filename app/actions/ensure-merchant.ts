// app/actions/ensure-merchant.ts
"use server";

/**
 * TEMP IMPLEMENTATION
 * -------------------
 * We are not using real per-user merchant accounts yet.
 * For now, we just return a single demo merchant ID so
 * the rest of the app can keep working.
 */

const DEMO_MERCHANT_ID =
  process.env.DEMO_MERCHANT_ID ??
  "11111111-1111-1111-1111-111111111111"; // fallback

export async function ensureMerchantId(): Promise<string> {
  // In the future this will:
  // - look at the logged-in Supabase user
  // - create/find a Merchant row for that user
  // For now, just return the demo merchant ID.
  return DEMO_MERCHANT_ID;
}
