// app/login/login-client.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginClient({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn() {
    setErr(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // go where we intended
      router.replace(returnTo || "/merchant/profile");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
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
        />

        <button
          onClick={signIn}
          disabled={loading || !email || !password}
          className={[
            "mt-5 w-full rounded-full px-4 py-2 text-sm font-semibold transition",
            loading || !email || !password
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
