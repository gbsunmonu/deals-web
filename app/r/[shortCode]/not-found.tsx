// app/r/[shortCode]/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Code not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This redeem link is invalid or expired.
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/explore"
            className="inline-flex rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Explore deals
          </Link>
          <Link
            href="/login?returnTo=/merchant/profile"
            className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Merchant login
          </Link>
        </div>
      </div>
    </main>
  );
}
