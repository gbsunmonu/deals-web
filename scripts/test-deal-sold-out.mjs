/**
 * Test: DEAL SOLD OUT (maxRedemptions=1)
 * Creates MANY QR codes for the same deal, redeems them.
 * Retries when DB can't start a transaction fast enough.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DEAL_ID = process.env.DEAL_ID;
const COUNT = Number(process.env.COUNT || 10);
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
const RETRIES = Number(process.env.RETRIES || 5);

if (!DEAL_ID) {
  console.error("❌ DEAL_ID env var is required");
  process.exit(1);
}

async function postJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json = {};
  try {
    json = await res.json();
  } catch {}

  return { http: res.status, body: json };
}

function bucketize(r) {
  const s = r.body?.status;
  if (r.http === 200 && s === "REDEEMED") return "REDEEMED";
  if (r.http === 409 && s === "SOLD_OUT") return "SOLD_OUT";
  if (r.http === 409 && s === "ALREADY_REDEEMED") return "ALREADY_REDEEMED";

  const details = String(r.body?.details || "");
  if (r.http === 500 && details.includes("Unable to start a transaction")) return "TXN_TIMEOUT";

  return "OTHER";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function confirmWithRetry(qrUrl) {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const res = await postJson("/api/redemptions/confirm", { qrText: qrUrl });
    const bucket = bucketize(res);

    if (bucket !== "TXN_TIMEOUT") {
      return { qrUrl, ...res, bucket, attempts: attempt + 1 };
    }

    // backoff: 150ms, 300ms, 600ms, ...
    const wait = 150 * Math.pow(2, attempt);
    await sleep(wait);
  }

  return {
    qrUrl,
    http: 500,
    body: { error: "TXN_TIMEOUT_RETRY_EXHAUSTED" },
    bucket: "OTHER",
    attempts: RETRIES + 1,
  };
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let idx = 0;

  async function runner() {
    while (idx < items.length) {
      const my = idx++;
      results[my] = await worker(items[my], my);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, runner));
  return results;
}

async function main() {
  console.log("== DEAL SOLD-OUT TEST ==");
  console.log("BASE_URL:", BASE_URL);
  console.log("DEAL_ID:", DEAL_ID);
  console.log("COUNT:", COUNT);
  console.log("CONCURRENCY:", CONCURRENCY);
  console.log("RETRIES:", RETRIES);

  console.log("\n0) Checking availability endpoint...");
  try {
    const res = await fetch(`${BASE_URL}/api/deals/${DEAL_ID}/availability`);
    const data = await res.json().catch(() => ({}));
    console.log("Availability:", data);
  } catch {
    console.log("Availability check skipped.");
  }

  console.log(`\n1) Creating ${COUNT} QR codes...`);
  const qrUrls = [];
  for (let i = 0; i < COUNT; i++) {
    const r = await postJson("/api/redemptions/create", { dealId: DEAL_ID });
    if (r.http !== 201) {
      console.error("❌ Failed to create QR:", r);
      process.exit(1);
    }
    const shortCode = r.body?.shortCode || r.body?.code;
    qrUrls.push(`${BASE_URL}/r/${shortCode}`);
  }
  console.log("✅ Created", qrUrls.length, "QR codes");

  console.log(`\n2) Redeeming all QRs with concurrency=${CONCURRENCY}...`);
  const start = Date.now();

  const results = await runPool(qrUrls, CONCURRENCY, async (qrUrl) => {
    return confirmWithRetry(qrUrl);
  });

  const elapsed = Date.now() - start;

  const summary = results.reduce((acc, r) => {
    acc[r.bucket] = (acc[r.bucket] || 0) + 1;
    return acc;
  }, {});

  console.log("\n== Results ==");
  console.log("Elapsed:", `${elapsed}ms`);
  console.log(summary);

  const redeemed = summary.REDEEMED || 0;
  const soldOut = summary.SOLD_OUT || 0;
  const other = summary.OTHER || 0;

  // Print any OTHER samples
  if (other > 0) {
    console.log("\nSample OTHER:");
    for (const r of results.filter((x) => x.bucket === "OTHER").slice(0, 3)) {
      console.log("HTTP:", r.http);
      console.log("Body:", r.body);
      console.log("Attempts:", r.attempts);
      console.log("---");
    }
  }

  if (redeemed === 1 && soldOut === COUNT - 1 && other === 0) {
    console.log("\n✅ PASS: 1 REDEEMED, rest SOLD_OUT, no timeouts.");
    return;
  }

  console.log("\n⚠️ RESULT: Logic looks correct if REDEEMED=1. If SOLD_OUT is less than expected, DB timeouts happened.");
  process.exit(1);
}

main().catch((err) => {
  console.error("❌ Script crashed:", err);
  process.exit(1);
});
