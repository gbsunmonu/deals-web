// app/login/actions.ts
"use server";

import { redirect } from "next/navigation";
import { getServerSupabaseRSC } from "@/lib/supabase";

function safeReturnTo(v: string | null) {
  if (!v) return "/merchant/profile";
  // only allow internal redirects
  if (!v.startsWith("/")) return "/merchant/profile";
  if (v.startsWith("//")) return "/merchant/profile";
  return v;
}

export async function merchantLoginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const returnTo = safeReturnTo(String(formData.get("returnTo") || ""));

  if (!email || !password) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}&error=missing`);
  }

  const supabase = await getServerSupabaseRSC();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/login?returnTo=${encodeURIComponent(returnTo)}&error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  redirect(returnTo);
}

export async function merchantLogoutAction() {
  const supabase = await getServerSupabaseRSC();
  await supabase.auth.signOut();
  redirect("/");
}
