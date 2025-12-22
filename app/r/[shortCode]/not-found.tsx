// app/r/[shortCode]/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Yes to Deals
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          QR not found
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This QR code is invalid or has been removed.
        </p>

        <div className="mt-5 flex gap-2">
          <Link
            href="/explore"
            className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Explore deals
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
