// app/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();

    // Sign out the current user (if any)
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[/logout] sign out error:", err);
    // We still redirect even if sign-out fails
  }

  // Redirect back to home (or /auth/sign-in if you prefer)
  return NextResponse.redirect(new URL("/", req.url), { status: 302 });
}
