// lib/visitor.ts
import { cookies, headers } from "next/headers";
import { randomUUID } from "crypto";

export const VISITOR_COOKIE = "ytd_vid";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

/**
 * RSC-safe visitor id:
 * - reads cookie if present
 * - else generates a UUID (and returns it; cookie must be set in a Route Handler / Middleware / Server Action response)
 */
export async function getVisitorIdRSC(): Promise<string> {
  // ✅ Next 16: cookies() can be async → await it
  const cookieStore = await cookies();
  const vid = cookieStore.get(VISITOR_COOKIE)?.value || "";
  if (vid && isUuid(vid)) return vid;

  // fallback: deterministic-ish id from headers (rare)
  const h = await headers();
  const ua = h.get("user-agent") || "";
  const accept = h.get("accept-language") || "";
  const seed = `${ua}|${accept}`;

  // If you prefer true random always:
  // return randomUUID();

  // Cheap stable-ish UUID from seed
  // (not cryptographically strong, but fine as fallback)
  const hash = await stableHash(seed);
  const fake = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(
    13,
    16
  )}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;

  return isUuid(fake) ? fake : randomUUID();
}

async function stableHash(s: string) {
  // WebCrypto available in Node 18+ (Next runtime)
  const enc = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
