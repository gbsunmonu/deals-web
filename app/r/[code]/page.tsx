// app/r/[code]/page.tsx

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 0;

type RedemptionPageProps = {
  params: Promise<{ code: string }>;
};

export default async function RedemptionPage({ params }: RedemptionPageProps) {
  const { code } = await params;

  if (!code) {
    notFound();
  }

  const redemption = await prisma.redemption.findUnique({
    where: { shortCode: code },
    include: {
      deal: {
        include: {
          merchant: true,
        },
      },
    },
  });

  if (!redemption || !redemption.deal) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold">Redemption not found</h1>
        <p className="text-sm text-gray-600">
          This redemption code is invalid or has been removed.
        </p>
      </main>
    );
  }

  const { deal } = redemption;
  const merchant = deal.merchant;
  const isRedeemed = redemption.redeemed;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold">Confirm redemption</h1>

      <section className="mb-6 rounded-lg border bg-white p-4 text-sm shadow-sm">
        <p className="mb-1 text-xs text-gray-500">Short code</p>
        <p className="mb-3 font-mono text-lg font-semibold">
          {redemption.shortCode}
        </p>

        <p className="mb-1 text-xs text-gray-500">Deal</p>
        <p className="mb-3 text-sm font-medium">{deal.title}</p>

        {merchant && (
          <>
            <p className="mb-1 text-xs text-gray-500">Merchant</p>
            <p className="mb-2 text-sm">
              {merchant.name}
              {merchant.city ? ` · ${merchant.city}` : ""}
            </p>
          </>
        )}

        <p className="mt-2 text-xs text-gray-600">
          Valid until{" "}
          {new Date(deal.endsAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </section>

      <section className="rounded-lg border bg-white p-4 text-sm shadow-sm">
        {isRedeemed ? (
          <p className="text-sm font-medium text-green-700">
            ✅ This redemption has already been confirmed on{" "}
            {redemption.redeemedAt
              ? new Date(redemption.redeemedAt).toLocaleString()
              : "a previous date"}
            .
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-gray-600">
              Merchant: if the customer is in front of you and you have
              validated the discount, tap the button below to confirm.
            </p>

            <form
              action="/api/redemptions/confirm"
              method="POST"
              className="inline-flex items-center gap-2"
            >
              <input type="hidden" name="shortCode" value={redemption.shortCode} />
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-black px-4 py-2 text-xs font-medium text-white hover:bg-gray-900"
              >
                Confirm redemption
              </button>
            </form>
          </>
        )}
      </section>

      <div className="mt-6">
        <Link
          href="/deals"
          className="text-xs font-medium text-gray-600 hover:underline"
        >
          ← Back to deals
        </Link>
      </div>
    </main>
  );
}
