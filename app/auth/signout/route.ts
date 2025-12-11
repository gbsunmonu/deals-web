import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}
