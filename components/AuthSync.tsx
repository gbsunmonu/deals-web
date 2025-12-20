"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) return null;

  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Refresh RSC tree when login/logout happens.
 * IMPORTANT: only refresh on SIGNED_IN / SIGNED_OUT (prevents infinite loops).
 */
export default function AuthSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => data.subscription.unsubscribe();
  }, [router]);

  return null;
}
