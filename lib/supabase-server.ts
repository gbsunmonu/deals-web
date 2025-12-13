// lib/supabase-server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

/**
 * ✅ Use this inside Server Components (app/* pages/layouts).
 * It can READ auth cookies, but should NOT try to persist updated cookies here.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // Server Components shouldn't set cookies — no-op
      setAll() {},
    },
  });
}

/**
 * ✅ Use this ONLY inside Route Handlers (example: app/api/whatever/route.ts).
 * It reads cookies from the incoming request and writes updated cookies to the response.
 */
export function createSupabaseRouteClient(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  return { supabase, res };
}
