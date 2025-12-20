// app/page.tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="bg-slate-50">
      {/* HERO */}
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-14 pt-10 lg:flex-row lg:items-center">
        {/* HERO LEFT */}
        <div className="max-w-xl space-y-5">
          <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Dealina · Save more locally
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Save money on local deals with{" "}
            <span className="text-emerald-600">QR codes</span>.
          </h1>

          <p className="text-sm leading-relaxed text-slate-600">
            Discover discounts from barbers, salons, food spots and more around you.
            No account needed for shoppers — just open a deal, get the QR code, and
            show it at the store.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/explore"
              className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Browse live deals
              <span className="ml-1 text-lg" aria-hidden="true">
                →
              </span>
            </Link>

            <Link
              href="/login?returnTo=/merchant/profile"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              I&apos;m a merchant
            </Link>
          </div>

          <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              No sign-up needed for customers
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Merchants track redemptions
            </div>
          </div>
        </div>

        {/* HERO RIGHT – simple savings card */}
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-slate-900 p-5 text-slate-50 shadow-[0_24px_60px_rgba(15,23,42,0.45)]">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                Example savings
              </span>
              <span className="text-[11px] text-slate-400">Made with Dealina</span>
            </div>

            <p className="text-xs text-slate-300">
              Customer used a Dealina QR code at{" "}
              <span className="font-semibold text-slate-50">Yossie Salon – Ikeja</span>.
            </p>

            <div className="mt-4 rounded-2xl bg-slate-800/80 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                They saved
              </p>
              <p className="mt-1 text-3xl font-semibold text-emerald-400">₦4,800</p>
              <p className="mt-1 text-xs text-slate-300">
                Paid <span className="font-semibold text-slate-50">₦3,200</span> instead of{" "}
                <span className="line-through">₦8,000</span>.
              </p>
            </div>

            <p className="mt-3 text-[11px] text-slate-400">
              No points, no codes to remember — just a QR.
            </p>
          </div>
        </div>
      </div>

      {/* MERCHANT CTA */}
      <section className="border-t border-slate-200 bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-slate-50 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              For merchants
            </p>
            <p className="mt-1 text-sm font-semibold">
              Turn quiet days into busy ones with simple, trackable deals.
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Create offers, generate QR codes, and see redemptions.
            </p>
          </div>
          <Link
            href="/login?returnTo=/merchant/deals/new"
            className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Create your first deal
            <span className="ml-1 text-sm" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
