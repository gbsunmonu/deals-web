// components/AuthSync.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // Forces server components (layout) to refetch auth state
      router.refresh();
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  return null;
}
