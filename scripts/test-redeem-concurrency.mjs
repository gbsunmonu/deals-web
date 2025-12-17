// scripts/test-redeem-concurrency.mjs
// Usage (PowerShell):
//   $env:BASE_URL="http://localhost:3000"
//   $env:DEAL_ID="...uuid..."
//   $env:COUNT="15"
//   $env:CONCURRENCY="3"     # how many in parallel
//   node scripts/test-redeem-concurrency.mjs

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DEAL_ID = process.env.DEAL_ID;
const COUNT = Number(process.env.COUNT || "15");
const CONCURRENCY = Number(process.env.CONCURRENCY || "3");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!DEAL_ID) {
  console.error("❌ Missing DEAL_ID env var.");
  process.exit(1);
}
if (!UUID_RE.test(DEAL_ID)) {
  console.error("❌ DEAL_ID must be a UUID. You passed:", DEAL_ID);
  process.exit(1);
}

async function postJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  return { res, data };
}

function classify(res, data) {
  const status = data?.status || (res.ok ? "OK" : "ERR");

  if (res.ok && status === "REDEEMED") return "REDEEMED";
  if (!res.ok && status === "SOLD_OUT") return "SOLD_OUT";
  if (!res.ok && status === "ALREADY_REDEEMED") return "ALREADY_REDEEMED";
  if (!res.ok && status === "EXPIRED") return "EXPIRED";
  if (!res.ok && status === "CONFLICT") return "CONFLICT";
  if (!res.ok && (data?.details || "").toLowerCase().includes("unable to start a transaction"))
    return "TXN_TIMEOUT";
  return "OTHER";
}

async function runPool(items, concurrency, worker) {
  const results = [];
  let idx = 0;

  async function runOne() {
    while (idx < items.length) {
      const my = idx++;
      results[my] = await worker(items[my], my);
    }
  }

  const runners = Array.from({ length: Math.max(1, concurrency) }, runOne);
  await Promise.all(runners);
  return results;
}

async function main() {
  console.log("== Redeem Concurrency Test ==");
  console.log("BASE_URL:", BASE_URL);
  console.log("DEAL_ID:", DEAL_ID);
  console.log("COUNT:", COUNT);
  console.log("CONCURRENCY:", CONCURRENCY);
  console.log("");

  // 1) Create redemption QR
  console.log("1) Creating a redemption code...");
  const created = await postJson("/api/redemptions/create", { dealId: DEAL_ID });

  if (!created.res.ok) {
    console.error("❌ Failed to create redemption:", created.res.status, created.data);
    process.exit(1);
  }

  const shortCode = created.data?.shortCode || created.data?.code;
  if (!shortCode) {
    console.error("❌ Create response missing shortCode/code:", created.data);
    process.exit(1);
  }

  const qrPayload = `${BASE_URL}/r/${shortCode}`;
  console.log("✅ Created shortCode:", shortCode);
  console.log("✅ QR payload to redeem:", qrPayload);
  console.log("");

  // 2) Concurrent redeems (controlled)
  console.log(`2) Firing ${COUNT} redeems with concurrency=${CONCURRENCY}...`);

  const start = Date.now();

  const jobs = Array.from({ length: COUNT }, (_, i) => i + 1);

  const results = await runPool(jobs, CONCURRENCY, async (n) => {
    const r = await postJson("/api/redemptions/confirm", { qrText: qrPayload });
    const bucket = classify(r.res, r.data);
    return { n, http: r.res.status, bucket, body: r.data };
  });

  const elapsed = Date.now() - start;

  const counts = results.reduce((acc, r) => {
    acc[r.bucket] = (acc[r.bucket] || 0) + 1;
    return acc;
  }, {});

  console.log("");
  console.log("== Results ==");
  console.log("Elapsed:", `${elapsed}ms`);
  console.log(counts);
  console.log("");

  const redeemed = counts["REDEEMED"] || 0;
  if (redeemed > 1) {
    console.error("❌ FAIL: more than one REDEEMED. Concurrency protection is NOT working.");
    process.exit(2);
  }

  if ((counts["TXN_TIMEOUT"] || 0) > 0) {
    console.warn("⚠️ You hit TXN_TIMEOUT. Reduce CONCURRENCY (e.g. 2 or 1) or increase DB pool/timeout.");
  }

  console.log("✅ PASS: concurrency looks correct (REDEEMED <= 1).");
}

main().catch((e) => {
  console.error("❌ Script crashed:", e);
  process.exit(99);
});
