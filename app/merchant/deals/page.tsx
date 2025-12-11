// app/merchant/deals/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type DealStatus = "ACTIVE" | "UPCOMING" | "ENDED";

function getDealStatus(startsAt: Date, endsAt: Date): DealStatus {
  const now = new Date();
  if (startsAt > now) return "UPCOMING";
  if (endsAt < now) return "ENDED";
  return "ACTIVE";
}

function formatNaira(value: number | null | undefined) {
  if (value == null || isNaN(value)) return "—";
  return `₦${value.toLocaleString("en-NG")}`;
}

export default async function MerchantDealsPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?next=/merchant/deals");
  }

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
  });

  if (!merchant) {
    // No merchant profile yet – send them to merchant home
    redirect("/merchant/profile");
  }

  const deals = await prisma.deal.findMany({
    where: { merchantId: merchant.id },
    orderBy: { startsAt: "desc" },
  });

  // Small debug log (you can keep or remove)
  console.log(
    "[MyDeals] discounts:",
    deals.map((d) => ({
      id: d.id,
      title: d.title,
      discountValue: d.discountValue,
    })),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-500">
            MERCHANT
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            My deals
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            A clean overview of every deal you&apos;ve created.
          </p>
        </div>

        <Link
          href="/merchant/deals/new"
          className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          + Create new deal
        </Link>
      </header>

      {/* Deals list */}
      {deals.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          You haven&apos;t created any deals yet.{" "}
          <Link
            href="/merchant/deals/new"
            className="font-semibold text-emerald-600 hover:underline"
          >
            Create your first deal
          </Link>{" "}
          to start attracting customers.
        </div>
      ) : (
        <ul className="space-y-4">
          {deals.map((deal) => {
            const status = getDealStatus(deal.startsAt, deal.endsAt);

            const rawDiscount = deal.discountValue;
            const discount =
              typeof rawDiscount === "number"
                ? rawDiscount
                : rawDiscount == null
                ? 0
                : Number(rawDiscount as any);

            const hasDiscount = discount > 0 && deal.originalPrice != null;

            const original = deal.originalPrice ?? 0;
            const discountedPrice =
              hasDiscount && original > 0
                ? Math.round(original - (original * discount) / 100)
                : original || null;

            const startsAt = deal.startsAt;
            const endsAt = deal.endsAt;

            return (
              <li
                key={deal.id}
                className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                {/* Left side: basic info */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {deal.title}
                    </p>

                    {/* Status pill */}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : status === "UPCOMING"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {status === "ACTIVE"
                        ? "Active"
                        : status === "UPCOMING"
                        ? "Upcoming"
                        : "Ended"}
                    </span>

                    {/* Discount pill – THIS is the one that was empty before */}
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {discount > 0 ? `${discount}% OFF` : "No discount set"}
                    </span>
                  </div>

                  {/* Dates */}
                  <p className="text-xs text-slate-500">
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

                  {/* Price summary */}
                  <p className="text-xs text-slate-500">
                    {hasDiscount && discountedPrice != null && original > 0 ? (
                      <>
                        From{" "}
                        <span className="line-through">
                          {formatNaira(original)}
                        </span>{" "}
                        now {formatNaira(discountedPrice)} —{" "}
                        <span className="font-semibold text-emerald-700">
                          {discount}% off
                        </span>
                      </>
                    ) : original > 0 ? (
                      <>Price: {formatNaira(original)}</>
                    ) : (
                      <>Price not set</>
                    )}
                  </p>
                </div>

                {/* Right side: actions */}
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Link
                    href={`/deals/${deal.id}`}
                    className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </Link>
                  <Link
                    href={`/merchant/deals/${deal.id}/edit`}
                    className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                  >
                    Edit deal
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
