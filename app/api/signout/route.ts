// deals-web/app/api/signout/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createSupabaseServer(); // ✅ await

  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
  );
}
