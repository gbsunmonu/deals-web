import { cookies, headers } from "next/headers";
import { randomUUID, createHash } from "crypto";

const VISITOR_COOKIE = "ytd_visitor";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * ✅ RSC-safe: cookies() is a Promise in your Next 16 build
 */
export async function getVisitorIdRSC(): Promise<string> {
  const cookieStore = await cookies();
  const vid = cookieStore.get(VISITOR_COOKIE)?.value || "";
  if (vid && isUuid(vid)) return vid;

  // fallback (rare): deterministic-ish id from headers
  const h = await headers();
  const ua = h.get("user-agent") || "";
  const accept = h.get("accept-language") || "";
  const seed = `${ua}|${accept}`;
  const candidate = sha256(seed).slice(0, 32);
  // not a uuid, so generate real uuid
  return randomUUID();
}

export { VISITOR_COOKIE };
