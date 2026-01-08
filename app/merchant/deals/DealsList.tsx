"use client";

import React from "react";
import Link from "next/link";
import { repostDealAction } from "./repost-action";

type DealsListProps = {
  deals: any[];
};

const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "UPCOMING", label: "Upcoming" },
  { id: "ENDED", label: "Ended" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export default function DealsList({ deals }: DealsListProps) {
  const [filter, setFilter] = React.useState<FilterId>("ALL");

  const countsByStatus = React.useMemo(() => {
    const base = { ACTIVE: 0, UPCOMING: 0, ENDED: 0 };
    for (const d of deals) {
      if (d.status === "ACTIVE") base.ACTIVE++;
      if (d.status === "UPCOMING") base.UPCOMING++;
      if (d.status === "ENDED") base.ENDED++;
    }
    return base;
  }, [deals]);

  const filteredDeals =
    filter === "ALL" ? deals : deals.filter((d) => d.status === filter);

  const hasAnyDeals = deals.length > 0;

  return (
    <section className="space-y-4">
      {/* Filters row */}
      {hasAnyDeals && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {FILTERS.map((f) => {
              const isActive = filter === f.id;
              const countLabel =
                f.id === "ALL"
                  ? deals.length
                  : f.id === "ACTIVE"
                  ? countsByStatus.ACTIVE
                  : f.id === "UPCOMING"
                  ? countsByStatus.UPCOMING
                  : countsByStatus.ENDED;

              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium transition ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${
                      isActive
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {countLabel}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {filteredDeals.length}
            </span>{" "}
            {filter === "ALL" ? "deals" : filter.toLowerCase() + " deals"}.
          </p>
        </div>
      )}

      {/* Filter has no results */}
      {hasAnyDeals && filteredDeals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          <p>
            No deals match this filter yet. Try switching to{" "}
            <button
              type="button"
              className="font-semibold text-emerald-700 hover:underline"
              onClick={() => setFilter("ALL")}
            >
              All
            </button>
            .
          </p>
        </div>
      )}

      {/* Deals list */}
      <div className="space-y-3">
        {filteredDeals.map((deal) => {
          const redemptions = deal._count?.redemptions ?? 0;
          const originalPrice = deal.originalPrice ?? 0;
          const discountValue = deal.discountValue ?? 0;

          const discountedPrice =
            originalPrice && discountValue
              ? originalPrice - Math.round((originalPrice * discountValue) / 100)
              : null;

          const startsAt = new Date(deal.startsAt);
          const endsAt = new Date(deal.endsAt);

          const canRepost = deal.status === "ENDED";

          return (
            <article
              key={deal.id}
              className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-white hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              {/* LEFT: content */}
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {deal.title}
                  </h2>
                  <StatusPill status={deal.status} />
                </div>

                <p className="line-clamp-1 text-xs text-slate-500">
                  {deal.description || "No description added for this deal yet."}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  {/* Discount + price */}
                  <div className="inline-flex items-center gap-1">
                    <span className="font-medium text-slate-700">
                      {discountValue ? `${discountValue}% OFF` : "No discount"}
                    </span>
                    {originalPrice ? (
                      <>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="line-through">
                          ₦{originalPrice.toLocaleString("en-NG")}
                        </span>
                        {discountedPrice !== null && (
                          <span className="font-semibold text-emerald-700">
                            ₦{discountedPrice.toLocaleString("en-NG")}
                          </span>
                        )}
                      </>
                    ) : null}
                  </div>

                  <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />

                  {/* Dates */}
                  <div className="inline-flex items-center gap-1">
                    <span>
                      {startsAt.toLocaleDateString("en-NG")} –{" "}
                      {endsAt.toLocaleDateString("en-NG")}
                    </span>
                  </div>

                  <span className="h-1 w-1 rounded-full bg-slate-300" />

                  {/* Redemptions */}
                  <div className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>{redemptions} redemptions</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: actions */}
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
                <Link
                  href={`/merchant/deals/${deal.id}/edit`}
                  className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition group-hover:border-slate-300 group-hover:bg-slate-50"
                >
                  Edit
                </Link>

                <Link
                  href={`/explore`}
                  className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition group-hover:border-slate-300 group-hover:bg-slate-50"
                >
                  View Explore
                </Link>

                {/* ✅ NEW: Repost expired deal */}
                {canRepost && (
                  <form action={repostDealAction}>
                    <input type="hidden" name="dealId" value={deal.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Repost
                    </button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: "ACTIVE" | "UPCOMING" | "ENDED" }) {
  const label =
    status === "ACTIVE" ? "Active" : status === "UPCOMING" ? "Upcoming" : "Ended";

  const classes =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "UPCOMING"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}
