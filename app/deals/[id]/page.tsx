// app/deals/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import GetRedeemQrButton from "./GetRedeemQrButton";
import ViewTracker from "@/components/ViewTracker";

type DealDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatNaira(value: number | null) {
  if (value == null || isNaN(value)) return "—";
  return `₦${value.toLocaleString("en-NG")}`;
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;
  if (!id) return notFound();

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      merchant: {
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          phone: true,
          website: true,
        },
      },
    },
  });

  if (!deal) return notFound();

  const original = deal.originalPrice ?? 0;

  const rawDiscount = deal.discountValue as unknown;
  const discount =
    typeof rawDiscount === "number"
      ? rawDiscount
      : rawDiscount == null
      ? 0
      : Number(rawDiscount as any);

  const hasDiscount = discount > 0 && original > 0;

  const discountedPrice = hasDiscount
    ? Math.round(original - (original * discount) / 100)
    : original || null;

  const savingsAmount =
    hasDiscount && discountedPrice != null ? original - discountedPrice : null;

  const startsAt = new Date(deal.startsAt);
  const endsAt = new Date(deal.endsAt);

  const now = new Date();
  let statusLabel: "Live now" | "Starting soon" | "Expired";
  let statusColor =
    "bg-emerald-50 text-emerald-700 border border-emerald-100";

  if (now < startsAt) {
    statusLabel = "Starting soon";
    statusColor = "bg-amber-50 text-amber-700 border border-amber-100";
  } else if (now > endsAt) {
    statusLabel = "Expired";
    statusColor = "bg-slate-50 text-slate-500 border border-slate-200";
  } else {
    statusLabel = "Live now";
    statusColor = "bg-emerald-50 text-emerald-700 border border-emerald-100";
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-4">
      {/* ✅ Track deal view (deduped by device/day) */}
      <ViewTracker type="DEAL_VIEW" dealId={deal.id} merchantId={deal.merchant.id} />

      {/* Breadcrumbs */}
      <nav className="mb-4 text-xs text-slate-500">
        <Link href="/explore" className="hover:text-slate-700">
          Explore deals
        </Link>
        <span className="mx-1">›</span>
        <span className="font-medium text-slate-700 line-clamp-1">
          {deal.title}
        </span>
      </nav>

      {/* TOP: Image + summary */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)]">
        <div className="aspect-[16/9] w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-900">
          {deal.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.imageUrl}
              alt={deal.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
              No image available for this deal
            </div>
          )}
        </div>

        <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Deal summary
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Generate a QR and show it at checkout to redeem.
              </p>
            </div>

            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${statusColor}`}
            >
              {statusLabel}
            </span>
          </header>

          <div className="mt-3 grid grid-cols-2 gap-4 border-b border-slate-100 pb-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase text-slate-500">
                Original price
              </p>
              <p className="mt-1 text-base font-semibold text-slate-500 line-through">
                {formatNaira(original)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase text-slate-500">
                You pay at the store
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">
                {formatNaira(discountedPrice)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex-1">
            {hasDiscount && savingsAmount != null && savingsAmount > 0 ? (
              <div className="flex h-full items-stretch gap-3 rounded-2xl bg-emerald-50 px-4 py-3 min-h-[96px]">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase text-emerald-700">
                    You save
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-emerald-800">
                    {formatNaira(savingsAmount)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800/80">
                    Pay {formatNaira(discountedPrice)} instead of{" "}
                    {formatNaira(original)}.
                  </p>
                </div>

                <div className="flex flex-col items-end justify-between text-right text-xs">
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-emerald-700">
                      Discount
                    </p>
                    <p className="mt-1 text-base font-semibold text-emerald-800">
                      {discount}% off
                    </p>
                  </div>
                  <p className="mt-2 text-[10px] text-emerald-700/80">
                    Valid{" "}
                    {startsAt.toLocaleDateString("en-NG", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    –{" "}
                    {endsAt.toLocaleDateString("en-NG", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 min-h-[96px]">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-slate-600">
                    Deal price
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatNaira(discountedPrice)}
                  </p>
                  {original > 0 && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Same as the regular price.
                    </p>
                  )}
                </div>
                <p className="max-w-[180px] text-right text-[10px] text-slate-500">
                  Valid{" "}
                  {startsAt.toLocaleDateString("en-NG", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  –{" "}
                  {endsAt.toLocaleDateString("en-NG", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* LOWER: title + merchant + QR */}
      <section className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)]">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{deal.title}</h1>

          {deal.description && (
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">
              {deal.description}
            </p>
          )}

          <div className="mt-3 inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600">
            Valid{" "}
            {startsAt.toLocaleDateString("en-NG", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}{" "}
            –{" "}
            {endsAt.toLocaleDateString("en-NG", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Where you&apos;ll redeem this deal
            </h3>

            <p className="mt-2 text-sm font-medium text-slate-900">
              {deal.merchant.name}
            </p>

            {deal.merchant.city && (
              <p className="text-xs text-slate-500">{deal.merchant.city}</p>
            )}

            {deal.merchant.address && (
              <p className="mt-1 text-xs text-slate-500">
                {deal.merchant.address}
              </p>
            )}

            {deal.merchant.phone && (
              <p className="mt-1 text-xs text-slate-500">
                Phone: {deal.merchant.phone}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  deal.merchant.name +
                    (deal.merchant.city ? ` ${deal.merchant.city}` : "")
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full bg-black px-3 py-1.5 font-semibold text-white hover:bg-slate-900"
              >
                Open in Google Maps
              </a>

              {/* ✅ NEW: merchant page */}
              <Link
                href={`/m/${deal.merchant.id}`}
                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                View merchant deals
              </Link>

              <Link
                href="/explore"
                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Explore
              </Link>
            </div>
          </section>

          {/* QR CTA card */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Get your QR code
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              No account needed. Tap below to generate your redeem QR.
            </p>

            <div className="mt-4">
              <GetRedeemQrButton dealId={deal.id} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
