// lib/supabase.ts
// Server-only helpers for Supabase (no "use client" here)

import { createClient } from "@supabase/supabase-js";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import type { NextRequest } from "next/server";

// ---------- ENV ----------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ---------- Admin client (no auth cookies) ----------
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---------- For API route handlers: app/api/*/route.ts ----------
export function getServerSupabase(req: NextRequest) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        // Read cookie from the incoming request
        return req.cookies.get(name)?.value;
      },
      // For now we don't need to set/remove cookies from route handlers.
      // If we ever do, we'll set them on the Response instead.
      set(_name: string, _value: string, _options: CookieOptions) {},
      remove(_name: string, _options: CookieOptions) {},
    },
    headers: {
      get(name: string) {
        return req.headers.get(name) ?? undefined;
      },
    },
  });
}

// ---------- For server components (RSC) / layouts / pages ----------
// We DON'T touch next/headers.cookies() here to avoid cookieStore issues.
// Supabase will just treat the request as "no auth cookie found".
export function getServerSupabaseRSC() {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(_name: string) {
        // No cookie reading in RSC for now – prevents cookieStore.get error
        return undefined;
      },
      set(_name: string, _value: string, _options: CookieOptions) {},
      remove(_name: string, _options: CookieOptions) {},
    },
    headers: {
      get(_name: string) {
        // We don't need headers in RSC yet either
        return undefined;
      },
    },
  });
}
