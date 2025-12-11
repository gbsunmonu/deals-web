// app/deals/page.tsx
import prisma from "@/lib/prisma";

function formatCurrency(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return "-";
  return `₦${amount.toLocaleString("en-NG")}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function MyDealsPage() {
  // For now we just show all deals as "My deals"
  const deals = await prisma.deal.findMany({
    orderBy: { createdAt: "desc" },
    include: { merchant: true },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My deals</h1>
        <p className="mt-1 text-sm text-gray-500">
          Deals available to your account. (For now this lists all deals in the
          system.)
        </p>
      </div>

      {deals.length === 0 && (
        <p className="text-sm text-gray-600">
          You don&apos;t have any deals yet.
        </p>
      )}

      {deals.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <article
              key={deal.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              {/* Image */}
              <div className="h-40 w-full overflow-hidden bg-gray-100">
                {deal.imageUrl ? (
                  <img
                    src={deal.imageUrl}
                    alt={deal.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                    No image
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 line-clamp-2">
                    {deal.title}
                  </h2>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                    {deal.merchant?.name ?? "Merchant"}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  {deal.originalPrice ? (
                    <>
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-gray-400 line-through">
                            {formatCurrency(deal.originalPrice)}
                          </span>
                          <span className="text-lg font-bold text-emerald-600">
                            {formatCurrency(
                              Math.round(
                                (deal.originalPrice *
                                  (100 - deal.discountValue)) /
                                  100
                              )
                            )}
                          </span>
                        </div>
                        {deal.discountValue > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            {deal.discountValue}% OFF
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {deal.discountValue > 0
                        ? `${deal.discountValue}% off`
                        : "No price information"}
                    </p>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">
                    Valid {formatDate(deal.startsAt)} –{" "}
                    {formatDate(deal.endsAt)}
                  </span>
                  <a
                    href={`/deals/${deal.id}`}
                    className="text-[11px] font-semibold text-emerald-700 underline-offset-2 hover:underline"
                  >
                    View details
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
