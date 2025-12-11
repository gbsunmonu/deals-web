// app/deals/_components/PublicDealCard.tsx

"use client";

import Link from "next/link";
import Image from "next/image";

// Keep the type very flexible so it matches your existing data
type PublicDeal = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startsAt: string | Date;
  endsAt: string | Date;
  discountType?: string | null;
  discountValue?: number | null;
  merchant?: {
    name?: string | null;
    city?: string | null;
  } | null;
};

interface PublicDealCardProps {
  deal: PublicDeal;
}

/**
 * Returns a label like:
 *  - "Starts today"
 *  - "Starts in 1 day"
 *  - "Starts in 3 days"
 *  or null if the start date is in the past (active deal)
 */
function getCountdownLabel(startsAt: string | Date): string | null {
  const startDate = new Date(startsAt);
  const now = new Date();

  // If it already started, no countdown label
  if (startDate <= now) return null;

  const diffMs = startDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Starts today";
  if (diffDays === 1) return "Starts in 1 day";
  return `Starts in ${diffDays} days`;
}

export default function PublicDealCard({ deal }: PublicDealCardProps) {
  const countdownLabel = getCountdownLabel(deal.startsAt);
  const endsAtDate = new Date(deal.endsAt);

  const validUntilLabel = endsAtDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const discountLabel =
    deal.discountType === "PERCENTAGE"
      ? `${deal.discountValue ?? 0}%`
      : deal.discountValue != null
      ? `₦${deal.discountValue}`
      : "";

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-white text-sm shadow-sm">
      {/* IMAGE */}
      {deal.imageUrl ? (
        <div className="relative h-44 w-full">
          <Image
            src={deal.imageUrl}
            alt={deal.title}
            fill
            unoptimized
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-gray-100 text-gray-400">
          400 × 250
        </div>
      )}

      {/* CONTENT */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{deal.title}</h3>

          {/* 🔵 COUNTDOWN BADGE FOR FUTURE DEALS */}
          {countdownLabel && (
            <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              {countdownLabel}
            </span>
          )}
        </div>

        {deal.merchant && (
          <p className="mb-1 text-xs text-gray-500">
            {deal.merchant.name}
            {deal.merchant.city ? ` · ${deal.merchant.city}` : ""}
          </p>
        )}

        {deal.description && (
          <p className="mb-2 line-clamp-2 text-xs text-gray-600">
            {deal.description}
          </p>
        )}

        <p className="mb-2 text-xs text-gray-500">
          Valid until {validUntilLabel}
        </p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-xs font-semibold text-green-700">
            {discountLabel}
          </span>
          <Link
            href={`/deals/${deal.id}`}
            className="text-xs font-medium text-purple-700 hover:underline"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
