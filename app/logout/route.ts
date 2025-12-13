// deals-web/app/logout/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/";

  try {
    const supabase = await createSupabaseServer(); // ✅ await
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[/logout] sign out error:", err);
    // still redirect even if sign-out fails
  }

  return NextResponse.redirect(new URL(next, request.url));
}
