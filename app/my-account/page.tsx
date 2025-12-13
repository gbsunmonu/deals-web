// app/my-account/page.tsx

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";

export default async function MyAccountPage() {
  // ✅ IMPORTANT: await it (it returns a Promise in your setup)
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[/my-account] auth error:", error);
  }

  if (!user) {
    redirect("/auth/sign-in?next=/my-account");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-emerald-500">
          ACCOUNT
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">
          My account
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/merchant/profile"
            className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Merchant profile
          </Link>

          <Link
            href="/merchant/deals"
            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            My deals
          </Link>
        </div>
      </section>
    </main>
  );
}
