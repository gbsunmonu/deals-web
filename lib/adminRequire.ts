// lib/adminRequire.ts
import { NextRequest } from "next/server";
import { ADMIN_COOKIE, hashAdminPassword, safeEqual } from "@/lib/adminAuth";

export function isAdminRequest(req: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD || "";
  if (!pw) return false;

  const expected = hashAdminPassword(pw);
  const got = req.cookies.get(ADMIN_COOKIE)?.value || "";
  if (!got) return false;

  return safeEqual(got, expected);
}
