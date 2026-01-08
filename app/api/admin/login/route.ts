// app/api/admin/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, hashAdminPassword, safeEqual } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const password = String(form?.get("password") || "");

  const expectedPw = process.env.ADMIN_PASSWORD || "";
  if (!expectedPw) {
    return NextResponse.redirect(new URL("/admin/login?err=missing_password", req.url));
  }

  const ok = password && safeEqual(hashAdminPassword(password), hashAdminPassword(expectedPw));

  if (!ok) {
    return NextResponse.redirect(new URL("/admin/login?err=1", req.url));
  }

  const res = NextResponse.redirect(new URL("/admin/analytics", req.url));

  // store hashed password in cookie (never raw)
  res.cookies.set(ADMIN_COOKIE, hashAdminPassword(expectedPw), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
