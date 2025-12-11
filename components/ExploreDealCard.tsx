// components/ExploreDealCard.tsx
import Link from "next/link";

type ExploreDealCardProps = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  merchantName?: string;
  city?: string;
  discountValue: number;
  originalPrice: number | null;
  finalPrice: number | null;
  savings: number | null;
  startsAtLabel: string;
  endsAtLabel: string;
};

function formatCurrency(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return "-";
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default function ExploreDealCard({
  id,
  title,
  description,
  imageUrl,
  merchantName,
  city,
  discountValue,
  originalPrice,
  finalPrice,
  savings,
  startsAtLabel,
  endsAtLabel,
}: ExploreDealCardProps) {
  const hasSavings = savings != null && savings > 0;
  const hasDiscount = discountValue > 0;

  const subtitle =
    merchantName || city
      ? [merchantName, city].filter(Boolean).join(" • ")
      : null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      {/* IMAGE + BADGES */}
      <div className="relative h-40 w-full overflow-hidden bg-gray-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-medium text-gray-400">
            No image
          </div>
        )}

        {hasDiscount && (
          <div className="absolute left-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
            {discountValue}% OFF
          </div>
        )}

        {hasSavings && (
          <div className="absolute right-3 bottom-3 rounded-full bg-black/80 px-3 py-1 text-[11px] font-semibold text-emerald-300 shadow-sm">
            Save {formatCurrency(savings)}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        {/* Title + merchant */}
        <div className="space-y-1">
          <h2 className="line-clamp-1 text-sm font-semibold text-gray-900">
            {title}
          </h2>

          {subtitle && (
            <p className="line-clamp-1 text-[11px] font-medium text-gray-500">
              {subtitle}
            </p>
          )}

          {description && (
            <p className="line-clamp-2 text-[11px] text-gray-500">
              {description}
            </p>
          )}
        </div>

        {/* PRICE ROW */}
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex items-baseline gap-2">
            {finalPrice != null ? (
              <>
                <span className="text-base font-semibold text-gray-900">
                  {formatCurrency(finalPrice)}
                </span>
                {originalPrice != null && originalPrice !== finalPrice && (
                  <span className="text-xs text-gray-400 line-through">
                    {formatCurrency(originalPrice)}
                  </span>
                )}
              </>
            ) : originalPrice != null ? (
              <span className="text-base font-semibold text-gray-900">
                {formatCurrency(originalPrice)}
              </span>
            ) : (
              <span className="text-xs text-gray-500">Price not set</span>
            )}
          </div>

          {hasSavings && (
            <p className="text-[11px] text-emerald-700">
              From{" "}
              <span className="font-medium">
                {formatCurrency(originalPrice)}
              </span>{" "}
              now{" "}
              <span className="font-semibold">
                {formatCurrency(finalPrice)}
              </span>{" "}
              — you save{" "}
              <span className="font-semibold">
                {formatCurrency(savings)}
              </span>
              .
            </p>
          )}

          <p className="text-[11px] text-gray-500">
            Valid {startsAtLabel} – {endsAtLabel}
          </p>
        </div>

        {/* CTA ROW */}
        <div className="mt-3 flex items-center justify-between text-[11px]">
          {hasDiscount ? (
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
              Best for saving on everyday spend
            </span>
          ) : (
            <span className="text-[10px] text-gray-400">
              No discount set yet
            </span>
          )}

          <Link
            href={`/deals/${id}`}
            className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white hover:bg-black/90"
          >
            View details &amp; QR
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
