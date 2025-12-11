// components/auth/SignOutButton.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowser(), []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="text-sm text-slate-600 hover:text-slate-900"
    >
      Sign out
    </button>
  );
}
