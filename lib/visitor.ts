// lib/visitor.ts
import { cookies, headers } from "next/headers";
import { randomUUID, createHash } from "crypto";

export const VISITOR_COOKIE = "go_vid_v1";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * ✅ Server-safe visitor id getter
 * - In Next 16 / RSC, cookies() can be async -> we await it.
 */
export async function getVisitorIdRSC(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(VISITOR_COOKIE)?.value || "";
  if (existing && isUuid(existing)) return existing;

  // fallback (rare): deterministic-ish id from headers
  const h = await headers();
  const ua = h.get("user-agent") || "";
  const al = h.get("accept-language") || "";
  const seed = `${ua}|${al}`;
  const derived = sha256(seed).slice(0, 32);
  // not a real UUID, so generate a real one
  return randomUUID();
}

/**
 * ✅ Route-handler helper: set the cookie if missing
 */
export async function ensureVisitorCookie(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(VISITOR_COOKIE)?.value || "";
  if (existing && isUuid(existing)) return existing;

  const id = randomUUID();
  cookieStore.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return id;
}
