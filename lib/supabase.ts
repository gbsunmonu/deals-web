// lib/supabase.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "[supabase] SUPABASE_URL or SUPABASE_ANON_KEY is missing. Check your env vars."
  );
}

/**
 * Server-side Supabase client for RSC/server components/server actions.
 */
export function getServerSupabaseRSC() {
  // In Next 16 the validator treats this like a Promise type – we just
  // cast to any so we can use get/set/delete without TS errors.
  const cookieStore = cookies() as any;

  const client = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    } as any
  );

  return client;
}

/**
 * Admin Supabase client (service role).
 * Only use this in server-only code (API routes, server actions).
 */
export const supabaseAdmin = createSupabaseClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);
