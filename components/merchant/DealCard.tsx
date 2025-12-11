// deals-web/components/merchant/DealCard.tsx

import Link from "next/link";

type Deal = {
  id: string;
  title: string;
  description: string | null;
  discountValue: number | null;
  startsAt: string | Date;
  endsAt: string | Date;
  imageUrl?: string | null;
};

function getStatus(startsAt: Date, endsAt: Date) {
  const now = new Date();

  if (now < startsAt) return "Upcoming" as const;
  if (now > endsAt) return "Ended" as const;
  return "Active" as const;
}

function getStatusClasses(status: ReturnType<typeof getStatus>) {
  switch (status) {
    case "Active":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
    case "Upcoming":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-100";
    case "Ended":
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}

export function DealCard({ deal }: { deal: Deal }) {
  const startsAtDate = new Date(deal.startsAt);
  const endsAtDate = new Date(deal.endsAt);
  const status = getStatus(startsAtDate, endsAtDate);
  const statusClasses = getStatusClasses(status);
  const dateRange = `${startsAtDate.toLocaleDateString()} – ${endsAtDate.toLocaleDateString()}`;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-200 hover:shadow-md md:px-5 md:py-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* LEFT: image (optional) + text */}
        <div className="flex flex-1 items-start gap-4">
          {deal.imageUrl ? (
            <div className="hidden h-16 w-16 overflow-hidden rounded-xl bg-slate-100 md:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={deal.imageUrl}
                alt={deal.title}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="hidden h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-400 md:flex">
              NO IMAGE
            </div>
          )}

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="line-clamp-1 text-sm font-semibold text-slate-900 md:text-base">
                {deal.title}
              </h2>

              {deal.discountValue != null && (
                <span className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#00dfa3,#00b0ff)] px-2.5 py-0.5 text-[11px] font-semibold text-slate-900">
                  {deal.discountValue}% OFF
                </span>
              )}
            </div>

            {deal.description && (
              <p className="line-clamp-2 text-xs text-slate-500 md:text-sm">
                {deal.description}
              </p>
            )}

            <p className="pt-1 text-xs font-medium text-slate-500">
              {dateRange}
            </p>
          </div>
        </div>

        {/* RIGHT: status + actions */}
        <div className="flex flex-col items-start gap-2 md:items-end">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusClasses}`}
          >
            {status}
          </span>

          <div className="flex items-center gap-2 text-xs md:text-sm">
            <Link
              href={`/merchant/deals/${deal.id}/edit`}
              className="inline-flex items-center justify-center rounded-full border border-emerald-500 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 md:text-sm"
            >
              Edit deal
            </Link>

            <Link
              href={`/deals/${deal.id}`}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 md:text-sm"
            >
              View
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default DealCard;
