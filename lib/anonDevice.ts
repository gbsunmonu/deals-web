// lib/anonDevice.ts
import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "dealina_device";

/**
 * Returns existing deviceId from cookie or creates a new one.
 * Sets a secure, httpOnly cookie via NextResponse if created.
 */
export function getOrSetAnonDeviceId(req: NextRequest, res: NextResponse) {
  const existing = req.cookies.get(COOKIE_NAME)?.value;
  if (existing && existing.length >= 16) return existing;

  const deviceId = crypto.randomUUID();

  res.cookies.set({
    name: COOKIE_NAME,
    value: deviceId,
    httpOnly: true,
    sameSite: "lax",
    secure: true, // important on Vercel https
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return deviceId;
}

/**
 * Hash deviceId so we never store raw identifiers in DB.
 * Use DEVICE_HASH_SECRET in env for extra safety.
 */
export function hashDeviceId(deviceId: string) {
  const pepper = process.env.DEVICE_HASH_SECRET || "dev-pepper";
  return crypto.createHash("sha256").update(`${pepper}:${deviceId}`).digest("hex");
}
