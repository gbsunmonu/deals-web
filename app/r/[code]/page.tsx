// app/r/[code]/page.tsx

import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

type RedeemPageProps = {
  params: { code: string };
};

function formatNaira(value: number | null | undefined) {
  if (value == null || isNaN(value as any)) return "—";
  return `₦${Number(value).toLocaleString("en-NG")}`;
}

export default async function RedeemPage({ params }: RedeemPageProps) {
  const rawCode = params.code?.trim();

  if (!rawCode) {
    return notFound();
  }

  // 🔑 IMPORTANT: use `code` (the unique field), not `shortCode`
  const redemption = await prisma.redemption.findUnique({
    where: { code: rawCode },
    include: {
      deal: {
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!redemption) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          Invalid or unknown code
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          This QR / redemption code could not be found. Please check that the
          code was scanned correctly or contact the merchant.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Go back home
        </Link>
      </main>
    );
  }

  const deal = redemption.deal;
  const merchant = deal.merchant;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">
          Dealina · Redemption
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          Code verified
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          This code belongs to the deal below. The merchant can now choose to
          honor it and mark it as used in their own system.
        </p>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left text-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            Deal
          </p>
          <p className="mt-1 font-semibold text-slate-900">{deal.title}</p>
          {deal.description && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-3">
              {deal.description}
            </p>
          )}

          <div className="mt-3 flex justify-between text-xs text-slate-600">
            <div>
              <p className="text-[11px] font-medium uppercase text-slate-500">
                Merchant
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {merchant?.name ?? "Unknown merchant"}
              </p>
              {merchant?.city && (
                <p className="text-[11px] text-slate-500">{merchant.city}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase text-slate-500">
                Redeemed at
              </p>
              <p className="mt-1 text-xs text-slate-700">
                {redemption.redeemedAt.toLocaleString("en-NG", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <div>
            <p className="font-semibold text-emerald-900">
              Code: <span className="font-mono">{rawCode}</span>
            </p>
            <p className="mt-1 text-[11px]">
              Show this screen or the original QR to the merchant so they can
              confirm the deal.
            </p>
          </div>
        </div>

        <Link
          href="/explore"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Browse more deals
        </Link>
      </section>
    </main>
  );
}
