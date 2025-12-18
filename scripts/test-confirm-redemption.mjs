/**
 * scripts/test-confirm-redemption.mjs
 *
 * Usage:
 *   BASE_URL="http://localhost:3000" node scripts/test-confirm-redemption.mjs
 *   BASE_URL="https://deals-web-328f.vercel.app" node scripts/test-confirm-redemption.mjs
 *
 * Optional:
 *   DEAL_ID="48ca0820-b4ad-474d-bc72-933db9d550b9" node scripts/test-confirm-redemption.mjs
 *   SHORT_CODE="ABC123" node scripts/test-confirm-redemption.mjs
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DEAL_ID = process.env.DEAL_ID || ""; // optional (for legacy JSON test)
const SHORT_CODE = process.env.SHORT_CODE || ""; // optional (for shortCode test)

async function postConfirm(payload) {
  const url = `${BASE_URL}/api/redemptions/confirm`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" }, // your API reads req.text()
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  console.log("\n==============================");
  console.log("POST", url);
  console.log("Status:", res.status, res.statusText);
  console.log("Payload sent:", payload);
  console.log("Response JSON:", json);
  console.log("==============================\n");

  return { res, json };
}

function makeLegacyPayload(dealId) {
  // Use "expiresAt" if you want (your route checks it),
  // but for legacy, the "real" expiry should be handled by the new QR system.
  return {
    type: "DEAL",
    dealId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 mins from now
  };
}

async function main() {
  console.log("BASE_URL:", BASE_URL);

  // 1) Legacy payload test (matches your screenshot)
  if (DEAL_ID) {
    const legacy = makeLegacyPayload(DEAL_ID);
    await postConfirm(legacy);
  } else {
    console.log("Skipping legacy JSON test (set DEAL_ID env var to run it).");
  }

  // 2) Short code test
  if (SHORT_CODE) {
    await postConfirm(SHORT_CODE);
  } else {
    console.log("Skipping short code test (set SHORT_CODE env var to run it).");
  }

  // 3) Redeem URL test (confirm route extracts last segment from URL)
  if (SHORT_CODE) {
    await postConfirm(`${BASE_URL}/redeem/${SHORT_CODE}`);
  }
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
