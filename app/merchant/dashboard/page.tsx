// app/merchant/dashboard/page.tsx
import Link from "next/link";
import prisma from "@/lib/prisma";

// TEMP hard-coded merchant id for now
const MERCHANT_ID = "11111111-1111-1111-1111-111111111111";

export default async function MerchantDashboardPage() {
  // Load all deals for this merchant
  const deals = await prisma.deal.findMany({
    where: { merchantId: MERCHANT_ID },
    orderBy: { createdAt: "desc" },
  });

  const totalDeals = deals.length;
  const liveDeals = deals.filter((d) => {
    const now = new Date();
    return d.startsAt <= now && d.endsAt >= now;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Merchant dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of the deals you&apos;ve created on Dealina. Later we&apos;ll
            connect this to your real merchant account instead of a hard-coded
            ID.
          </p>
        </div>

        <Link
          href="/merchant/deals/new"
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          + Create new deal
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total deals
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {totalDeals}
          </p>
        </div>

        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Live right now
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {liveDeals}
          </p>
        </div>

        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Draft / expired
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {totalDeals - liveDeals}
          </p>
        </div>
      </div>

      {/* Deals table */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Your deals
          </h2>
          <p className="text-xs text-slate-500">
            Showing all deals for this merchant ID.
          </p>
        </div>

        {deals.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">
            You don&apos;t have any deals yet. Click{" "}
            <span className="font-medium">Create new deal</span> to add your
            first offer.
          </div>
        ) : (
          <div className="divide-y text-sm">
            {deals.map((deal) => {
              const now = new Date();
              const isLive =
                deal.startsAt <= now && deal.endsAt >= now;

              return (
                <div
                  key={deal.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {deal.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(deal.startsAt)}{" "}
                      –{" "}
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(deal.endsAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                        (isLive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600")
                      }
                    >
                      {isLive ? "Live" : "Not live"}
                    </span>

                    <Link
                      href={`/merchant/deals/${deal.id}/edit`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
