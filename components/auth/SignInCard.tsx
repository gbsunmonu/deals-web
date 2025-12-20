"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const AFTER_LOGIN = "/merchant/dashboard"; // 👈 change this if your dashboard is /merchant/deals etc.

type AuthMode = "signin" | "signup";

export default function SignInCard() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowser(), []);

  const [mode, setMode] = React.useState<AuthMode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setSuccess("Signed in successfully. Redirecting…");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccess("Account created. Redirecting…");
      }

      // ✅ Always send them to the merchant dashboard and refresh session
      router.push(AFTER_LOGIN);
      router.refresh();
    } catch (err: any) {
      console.error("Auth error", err);
      setError(err?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border bg-white px-6 py-7 shadow-sm">
      {/* Header / mode switch */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {mode === "signin" ? "Sign in to Yes to Deals" : "Create your Yes to Deals account"}

          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Use the same account across your merchant tools.
          </p>
        </div>

        <button
          type="button"
          className="text-xs font-medium text-indigo-600 hover:underline"
          onClick={() => {
            setError(null);
            setSuccess(null);
            setMode((m) => (m === "signin" ? "signup" : "signin"));
          }}
        >
          {mode === "signin" ? "Need an account?" : "Have an account?"}
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1 text-sm">
          <label className="block font-medium text-neutral-700">Email</label>
          <input
            type="email"
            required
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:border-indigo-500 focus:ring-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="space-y-1 text-sm">
          <label className="block font-medium text-neutral-700">Password</label>
          <input
            type="password"
            required
            minLength={6}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:border-indigo-500 focus:ring-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          <p className="text-xs text-neutral-500">
            Password must be at least 6 characters.
          </p>
        </div>

        {error && (
          <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {success && (
          <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-60"
        >
          {loading
            ? "Please wait…"
            : mode === "signin"
            ? "Sign in"
            : "Create account"}
        </button>
      </form>

      {/* Small hint */}
      <p className="mt-4 text-[11px] leading-relaxed text-neutral-500">
        By continuing, you agree to Yes to Deals’ terms of service. We’ll never share your

        email with third parties.
      </p>
    </div>
  );
}
