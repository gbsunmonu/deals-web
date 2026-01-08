// lib/visitor.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const VISITOR_COOKIE = "go_vid_v1";

/** Basic UUID v4/v5-ish validation */
export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

/**
 * Read visitor cookie from a NextRequest-like cookie store.
 * Works with NextRequest.cookies (Route Handlers).
 */
export function getVisitorIdFromRequest(req: { cookies: { get: (k: string) => { value?: string } | undefined } }) {
  const existing = req.cookies.get(VISITOR_COOKIE)?.value || "";
  if (existing && isUuid(existing)) return existing;
  return randomUUID();
}

/**
 * ✅ Set visitor cookie on a NextResponse (Route Handlers).
 * This is the function your build message suggests you already have.
 */
export function setVisitorCookieOnResponse(res: NextResponse, visitorId: string) {
  res.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
  });
  return res;
}
