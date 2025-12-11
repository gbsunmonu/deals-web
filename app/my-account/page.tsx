// app/my-account/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";

export default async function MyAccountPage() {
  const supabase = createSupabaseServer();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[/my-account] auth error:", error);
  }

  // If not logged in, go to sign-in and then back here
  if (!user) {
    redirect("/auth/sign-in?next=/my-account");
  }

  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleString("en-GB", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-500">
            ACCOUNT
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            My account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your merchant profile, deals and account details.
          </p>
        </div>

        <Link
          href="/merchant/deals"
          className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Go to merchant dashboard
        </Link>
      </header>

      {/* Main card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {user.email}
            </h2>
            {createdAt && (
              <p className="mt-1 text-xs text-slate-500">
                Joined Dealina on {createdAt}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 text-right text-xs text-slate-500">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
              Signed in
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* Merchant profile */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Merchant profile
            </h3>
            <p className="mt-2 text-xs text-slate-500">
              View and edit how your business appears on deals. You can update
              your logo, description, contact details and more.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/merchant/profile"
                className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                View profile
              </Link>
              <Link
                href="/merchant/profile/edit"
                className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Edit profile
              </Link>
            </div>
          </div>

          {/* Deals */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Deals
            </h3>
            <p className="mt-2 text-xs text-slate-500">
              Create new deals and manage your existing promotions. Customers
              will see these on the deal explorer.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/merchant/deals"
                className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                View all deals
              </Link>
              <Link
                href="/merchant/deals/new"
                className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Create new deal
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
