// app/login/login-client.tsx
"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginClient({ returnTo }: { returnTo: string }) {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anon) {
      // This makes the error obvious in the UI instead of “infinite loading”.
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in env."
      );
    }

    return createBrowserClient(url, anon);
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn() {
    if (loading) return;
    setErr(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      // ✅ IMPORTANT:
      // Use a HARD navigation so the Server Components + proxy auth sync
      // run immediately and you don’t get stuck on /login.
      const target = (returnTo && returnTo.startsWith("/"))
        ? returnTo
        : "/merchant/profile";

      window.location.assign(target);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Merchant login</h1>
      <p className="mt-2 text-sm text-slate-600">
        Customers don’t need accounts. Merchants log in to manage deals.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {err && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {err}
          </div>
        )}

        <label className="block text-sm font-semibold text-slate-700">
          Email
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="merchant@email.com"
          autoComplete="email"
        />

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Password
        </label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <button
          type="button"
          onClick={signIn}
          disabled={loading || !email.trim() || !password}
          className={[
            "mt-5 w-full rounded-full px-4 py-2 text-sm font-semibold transition",
            loading || !email.trim() || !password
              ? "bg-slate-200 text-slate-500 cursor-not-allowed"
              : "bg-emerald-600 text-white hover:bg-emerald-700",
          ].join(" ")}
        >
          {loading ? "Signing in…" : "Login"}
        </button>
      </div>
    </main>
  );
}
