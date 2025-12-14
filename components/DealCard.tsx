// components/DealCard.tsx
import Link from "next/link";

type DealCardProps = {
  deal: {
    id: string;
    title: string;
    originalPrice: number | null;
    discountValue: number | null;
    startsAt: string;
    endsAt: string;
    imageUrl: string | null;

    // ✅ NEW
    maxRedemptions: number | null;
    redeemedCount: number;
    left: number | null;
    soldOut: boolean;
  };
  merchant: {
    id: string;
    name: string;
    city: string | null;
  };
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatNaira(value: number | null) {
  if (value == null || isNaN(value)) return "—";
  return `₦${value.toLocaleString("en-NG")}`;
}

function formatDateRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  const sDay = s.getDate().toString().padStart(2, "0");
  const sMonth = MONTHS[s.getMonth()];
  const eDay = e.getDate().toString().padStart(2, "0");
  const eMonth = MONTHS[e.getMonth()];
  return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
}

export default function DealCard({ deal, merchant }: DealCardProps) {
  const rawDiscount = deal.discountValue;
  const discount =
    typeof rawDiscount === "number"
      ? rawDiscount
      : rawDiscount == null
      ? 0
      : Number(rawDiscount as any);

  const original = deal.originalPrice ?? 0;
  const hasDiscount = discount > 0 && original > 0;

  const discountedPrice = hasDiscount
    ? Math.round(original - (original * discount) / 100)
    : original || null;

  const savingsAmount =
    hasDiscount && discountedPrice != null ? original - discountedPrice : null;

  const isHotByAmount = savingsAmount != null && savingsAmount >= 1000;
  const isHotByPercent = discount >= 45;
  const isHot = isHotByAmount || isHotByPercent;

  const dateRange = formatDateRange(deal.startsAt, deal.endsAt);

  const showScarcity = typeof deal.maxRedemptions === "number" && deal.maxRedemptions > 0;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-52 bg-slate-950">
        {deal.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.imageUrl}
            alt={deal.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-300">
            No image
          </div>
        )}

        {/* top-left ribbons */}
        {(hasDiscount || isHot || deal.soldOut || (showScarcity && deal.left != null)) && (
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {deal.soldOut ? (
              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                Sold out
              </span>
            ) : showScarcity && deal.left != null ? (
              <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                {deal.left} left
              </span>
            ) : null}

            {hasDiscount && (
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                {discount}% OFF
              </span>
            )}

            {isHot && !deal.soldOut && (
              <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                🔥 Hot saving
              </span>
            )}
          </div>
        )}

        {/* top-right “Save ₦X” pill */}
        {hasDiscount && savingsAmount != null && savingsAmount > 0 && (
          <div className="absolute right-4 top-4 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-emerald-300 shadow-sm">
            Save {formatNaira(savingsAmount)}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <p className="text-xs font-medium text-slate-500">
          {merchant.name}
          {merchant.city && (
            <>
              <span className="mx-1 text-slate-400">·</span>
              <span>{merchant.city}</span>
            </>
          )}
        </p>

        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
          {deal.title}
        </h3>

        <div className="mt-4 rounded-3xl bg-emerald-50 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase text-emerald-700">
                YOU SAVE
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">
                {savingsAmount != null && savingsAmount > 0
                  ? formatNaira(savingsAmount)
                  : formatNaira(0)}
              </p>
              {original > 0 && discountedPrice != null && (
                <p className="mt-2 text-[11px] text-slate-600">
                  Pay {formatNaira(discountedPrice)} instead of {formatNaira(original)}.
                </p>
              )}
            </div>

            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase text-slate-500">
                DISCOUNT
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {hasDiscount ? `${discount}% off` : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <p>Valid {dateRange}</p>

          <Link
            href={`/deals/${deal.id}`}
            className={`inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-semibold text-white ${
              deal.soldOut ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
            aria-disabled={deal.soldOut}
          >
            View details &amp; QR →
          </Link>
        </div>

        {showScarcity && (
          <p className="mt-2 text-[11px] text-slate-500">
            {deal.soldOut
              ? "This deal is fully redeemed."
              : deal.left != null
              ? `${deal.redeemedCount} redeemed · ${deal.left} remaining`
              : ""}
          </p>
        )}
      </div>
    </article>
  );
}
