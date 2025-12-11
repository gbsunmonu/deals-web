// app/merchant/page.tsx
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

function isActiveDeal(deal: { startsAt: Date; endsAt: Date }) {
  const now = new Date();
  return deal.startsAt <= now && deal.endsAt >= now;
}

function isUpcomingDeal(deal: { startsAt: Date }) {
  const now = new Date();
  return deal.startsAt > now;
}

function getDealStatus(deal: { startsAt: Date; endsAt: Date }) {
  const now = new Date();
  if (deal.startsAt > now) return "UPCOMING";
  if (deal.endsAt < now) return "ENDED";
  return "ACTIVE";
}

type DealWithCounts = Awaited<
  ReturnType<typeof prisma.deal.findMany>
>[number] & { status?: "ACTIVE" | "UPCOMING" | "ENDED" };

export default async function MerchantHomePage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[/merchant] auth error:", authError);
  }

  if (!user) {
    redirect("/auth/sign-in?next=/merchant");
  }

  // 1) Find merchant for this user
  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    include: {
      deals: {
        include: {
          _count: { select: { redemptions: true } },
        },
      },
    },
  });

  if (!merchant) {
    redirect("/merchant/profile/edit");
  }

  const deals: DealWithCounts[] =
    merchant.deals?.map((d) => ({ ...d, status: getDealStatus(d) })) ?? [];

  // === Stats calculations ===
  const totalDeals = deals.length;
  const activeDeals = deals.filter(isActiveDeal);
  const activeDealsCount = activeDeals.length;
  const upcomingDealsCount = deals.filter(isUpcomingDeal).length;
  const endedDealsCount = totalDeals - activeDealsCount - upcomingDealsCount;

  const totalRedemptions = deals.reduce(
    (sum, deal) => sum + (deal._count?.redemptions ?? 0),
    0
  );

  // Actual savings from redeemed deals
  const savingsOffered = deals.reduce((sum, deal) => {
    const { originalPrice, discountValue } = deal;
    const redemptionsCount = deal._count?.redemptions ?? 0;

    if (!originalPrice || !discountValue || redemptionsCount === 0) {
      return sum;
    }

    const perRedemptionSavings = Math.round(
      (originalPrice * discountValue) / 100
    );

    return sum + perRedemptionSavings * redemptionsCount;
  }, 0);

  // Simple profile completion score
  const profileFields = [
    merchant.name,
    merchant.description,
    merchant.category,
    merchant.city,
    merchant.address,
    merchant.phone,
    merchant.email,
    merchant.website,
    merchant.avatarUrl,
  ];
  const filledCount = profileFields.filter(Boolean).length;
  const completion = Math.round((filledCount / profileFields.length) * 100);

  // Recent deals (last 4 by start date)
  const recentDeals = [...deals]
    .sort(
      (a, b) =>
        new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    )
    .slice(0, 4);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-500">
            MERCHANT
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            Merchant home
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            This is your main dashboard. Keep your details up to date and track
            how your deals are doing.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Link
            href="/merchant/deals/new"
            className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md"
          >
            + Create new deal
          </Link>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <Link
              href="/merchant/deals"
              className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50"
            >
              View my deals
            </Link>
            <Link
              href="/merchant/profile"
              className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit profile
            </Link>
          </div>
        </div>
      </header>

      {/* Top stats row */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active deals"
          value={activeDealsCount}
          helper={`${upcomingDealsCount} upcoming · ${endedDealsCount} ended`}
        />

        <StatCard
          title="Total deals"
          value={totalDeals}
          helper="Includes all active, upcoming and ended deals."
        />

        <StatCard
          title="Total redemptions"
          value={totalRedemptions}
          helper="Number of times customers have redeemed your deals."
        />

        <StatCard
          title="Savings offered"
          value={`₦${savingsOffered.toLocaleString("en-NG")}`}
          helper="Estimated value of discounts actually redeemed by customers."
        />
      </section>

      {/* Profile + status + recent deals */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            {/* Avatar */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600 overflow-hidden">
              {merchant.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={merchant.avatarUrl}
                  alt={merchant.name ?? "Merchant logo"}
                  className="h-full w-full object-cover"
                />
              ) : (
                (merchant.name ?? "M").charAt(0).toUpperCase()
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">
                  {merchant.name ?? "Your business name"}
                </h2>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Active on Dealina
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                {merchant.category && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {merchant.category}
                  </span>
                )}
                {merchant.city && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {merchant.city}
                  </span>
                )}
              </div>
            </div>

            <div className="ml-auto hidden text-[11px] text-slate-400 md:block">
              <p className="uppercase tracking-[0.15em]">PROFILE ID</p>
              <p className="mt-1 font-mono text-xs">
                {merchant.id.slice(0, 6)}••••
              </p>
            </div>
          </div>

          <hr className="my-4 border-slate-200" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">
                ABOUT THIS BUSINESS
              </p>
              <p className="text-sm text-slate-700">
                {merchant.description || "Add a short description of your business."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p className="text-xs font-semibold text-slate-500">CONTACT</p>
                {merchant.phone && <p>Phone<br />{merchant.phone}</p>}
                <p className="mt-1">
                  Email
                  <br />
                  {merchant.email}
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-xs font-semibold text-slate-500">LOCATION</p>
                {merchant.address && <p>Address<br />{merchant.address}</p>}
                {merchant.city && <p className="mt-1">City<br />{merchant.city}</p>}
              </div>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-slate-500">
            You can change your logo and details on the{" "}
            <Link
              href="/merchant/profile/edit"
              className="font-semibold text-emerald-700 hover:underline"
            >
              Edit profile
            </Link>{" "}
            page.
          </p>
        </div>

        {/* Right column: status + recent deals */}
        <div className="space-y-4">
          {/* Profile status card */}
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">
              PROFILE STATUS
            </p>

            <div className="mt-2 flex items-center gap-2 text-sm text-slate-800">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Visible on deals</span>
            </div>

            <p className="mt-2 text-[11px] text-slate-500">
              Customers see this information on every deal you publish. Keeping
              your profile updated increases trust and conversions.
            </p>

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Profile completion</span>
                <span className="font-semibold text-slate-700">
                  {completion}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Complete your description, logo, contact and location details so
              customers clearly understand your business.
            </p>
          </div>

          {/* Recent deals card */}
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">
              RECENT DEALS
            </p>

            {recentDeals.length === 0 ? (
              <p className="mt-3 text-[11px] text-slate-500">
                You haven&apos;t created any deals yet.{" "}
                <Link
                  href="/merchant/deals/new"
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  Create your first deal.
                </Link>
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentDeals.map((deal) => {
                  const startsAt = new Date(deal.startsAt);
                  const discountValue = deal.discountValue ?? 0;

                  return (
                    <li
                      key={deal.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                    >
                      {/* 👇 THIS BLOCK FIXES OVERFLOW */}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {deal.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Starts {startsAt.toLocaleDateString("en-NG")} ·{" "}
                          {discountValue}% OFF
                        </p>
                      </div>

                      <StatusPillSmall status={deal.status ?? "ACTIVE"} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

type StatCardProps = {
  title: string;
  value: number | string;
  helper?: string;
};

function StatCard({ title, value, helper }: StatCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div>
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      </div>
      {helper && (
        <p className="mt-3 text-[11px] leading-snug text-slate-500">{helper}</p>
      )}
    </div>
  );
}

function StatusPillSmall({
  status,
}: {
  status: "ACTIVE" | "UPCOMING" | "ENDED";
}) {
  const label =
    status === "ACTIVE" ? "Active" : status === "UPCOMING" ? "Upcoming" : "Ended";

  const classes =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "UPCOMING"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}
