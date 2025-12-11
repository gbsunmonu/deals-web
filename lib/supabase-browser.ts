// lib/supabase-browser.ts
"use client";

import { createClient } from "@supabase/supabase-js";

export function createSupabaseBrowser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    throw new Error(
      "Supabase env vars not set. Check your .env file and restart `npm run dev`."
    );
  }

  console.log("[Supabase] Browser client created with URL:", supabaseUrl);

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
