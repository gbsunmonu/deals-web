// app/merchant/redemptions/page.tsx
import prisma from "@/lib/prisma";
import RedeemForm from "@/components/RedeemForm";

const MERCHANT_ID =
  process.env.DEMO_MERCHANT_ID || "5b635f61-8a37-4b25-b21b-f02e8547edad";

function formatCurrency(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return "-";
  return `₦${amount.toLocaleString("en-NG")}`;
}

function formatDateTime(date: Date) {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MerchantRedemptionsPage() {
  const redemptions = await prisma.redemption.findMany({
    where: {
      deal: {
        merchantId: MERCHANT_ID,
      },
    },
    include: {
      deal: true,
    },
    orderBy: {
      redeemedAt: "desc",
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Redemptions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Redeem customer QR codes and review recent redemptions.
          </p>
        </div>
      </div>

      {/* Redeem form */}
      <div className="mb-8">
        <RedeemForm />
      </div>

      {/* Redemptions list */}
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Recent redemptions
        </h2>

        {redemptions.length === 0 ? (
          <p className="text-xs text-gray-500">
            No redemptions yet. Once you redeem a customer QR code, it will
            appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">
                    Deal
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">
                    Discount
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">
                    Original price
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">
                    Est. saving
                  </th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r) => {
                  const deal = r.deal;
                  const original = deal.originalPrice ?? 0;
                  const finalPrice =
                    original && deal.discountValue
                      ? Math.round(
                          (original * (100 - deal.discountValue)) / 100
                        )
                      : null;
                  const savings =
                    original && finalPrice ? original - finalPrice : null;

                  return (
                    <tr
                      key={r.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-3 py-2 align-top text-gray-700">
                        {formatDateTime(r.redeemedAt)}
                      </td>
                      <td className="px-3 py-2 align-top text-gray-800">
                        <div className="font-medium">{deal.title}</div>
                        <div className="text-[11px] text-gray-500">
                          ID: {deal.id}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-gray-700">
                        {deal.discountValue ? `${deal.discountValue}%` : "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-gray-700">
                        {formatCurrency(original)}
                      </td>
                      <td className="px-3 py-2 align-top text-gray-700">
                        {formatCurrency(savings)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
