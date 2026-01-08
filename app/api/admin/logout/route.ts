// app/api/admin/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Support both GET and POST (logout link or form submit)
export async function GET(req: NextRequest) {
  return logout(req);
}

export async function POST(req: NextRequest) {
  return logout(req);
}

function logout(req: NextRequest) {
  // Redirect back to admin login
  const url = new URL("/admin/login?out=1", req.url);
  const res = NextResponse.redirect(url);

  // Clear cookie in the response
  res.cookies.set(ADMIN_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });

  return res;
}
