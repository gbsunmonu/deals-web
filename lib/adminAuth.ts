// lib/adminAuth.ts
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

/**
 * Admin auth is intentionally NOT Supabase-based.
 * The app expects these exports in multiple places:
 * - ADMIN_COOKIE
 * - hashAdminPassword
 * - safeEqual
 *
 * We also provide requireAdmin() for server components.
 */

export const ADMIN_COOKIE = "admin_session_v1";

export function hashAdminPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

/**
 * Constant-time compare to avoid timing attacks.
 */
export function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Checks whether the current request has a valid admin session cookie.
 * Cookie stores sha256(ADMIN_PASSWORD).
 */
export async function requireAdmin(): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD || "";
  if (!pw) return false;

  const expected = hashAdminPassword(pw);

  const jar = await cookies();
  const cookie = jar.get(ADMIN_COOKIE)?.value || "";
  if (!cookie) return false;

  return safeEqual(cookie, expected);
}

/**
 * Backwards compatible helper (some code might import this name).
 */
export function getAdminCookieName() {
  return ADMIN_COOKIE;
}
