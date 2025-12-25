import { cookies, headers } from "next/headers";

const VISITOR_COOKIE = "ytd_vid";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Read visitorId in Server Components / RSC
 * Middleware should always set it, but we hard-fallback to avoid crashes.
 */
export async function getVisitorIdRSC(): Promise<string> {
  const vid = cookies().get(VISITOR_COOKIE)?.value || "";
  if (vid && isUuid(vid)) return vid;

  // fallback: create a deterministic-ish id from headers (rare)
  // NOTE: best effort only; middleware should prevent this path.
  const h = headers();
  const ua = h.get("user-agent") || "ua";
  const seed = `${Date.now()}-${ua}-${Math.random()}`;
  // not a uuid, but avoids null; you can also throw instead if you prefer strictness
  return cryptoRandomUuidFallback(seed);
}

/**
 * Read visitorId inside Route Handlers (req: NextRequest)
 */
export function getVisitorIdFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)ytd_vid=([^;]+)/);
  const vid = match ? decodeURIComponent(match[1]) : "";
  if (vid && isUuid(vid)) return vid;
  return null;
}

function cryptoRandomUuidFallback(_seed: string) {
  // If crypto.randomUUID exists in Node runtime:
  // @ts-ignore
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  // last resort
  return "00000000-0000-4000-8000-000000000000";
}
