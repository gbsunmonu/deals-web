// app/merchant/profile/page.tsx

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

function getDealStatus(deal: { startsAt: Date; endsAt: Date }) {
  const now = new Date();
  if (deal.startsAt > now) return "UPCOMING" as const;
  if (deal.endsAt < now) return "ENDED" as const;
  return "ACTIVE" as const;
}

export default async function MerchantProfileViewPage() {
  const supabase = createSupabaseServer();

  // -----------------------
  // SAFE AUTH BLOCK
  // -----------------------
  let user: { id: string; email?: string | null } | null = null;

  try {
    const {
      data: { user: supaUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // No session: send them to sign-in instead of crashing
      if (error.name === "AuthSessionMissingError") {
        redirect("/auth/sign-in?next=/merchant/profile");
      }

      console.error("[/merchant/profile] auth error:", error);
      redirect("/auth/sign-in?next=/merchant/profile");
    }

    if (!supaUser) {
      redirect("/auth/sign-in?next=/merchant/profile");
    }

    user = supaUser;
  } catch (err: any) {
    // Some versions actually THROW AuthSessionMissingError
    if (err?.name === "AuthSessionMissingError") {
      redirect("/auth/sign-in?next=/merchant/profile");
    }

    console.error("[/merchant/profile] unexpected auth error:", err);
    redirect("/auth/sign-in?next=/merchant/profile");
  }

  // At this point we are guaranteed to have a user
  if (!user) {
    redirect("/auth/sign-in?next=/merchant/profile");
  }

  // 1) Find or create merchant linked to this user
  let merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
  });

  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        userId: user.id,
        name:
          (user as any).user_metadata?.business_name ||
          user.email?.split("@")[0] ||
          "New merchant",
        description: "",
        category: "",
        city: "",
        address: "",
        phone: "",
        website: "",
        avatarUrl: null,
      },
    });
  }

  // 2) Fetch deals for this merchant + simple metrics
  const deals = await prisma.deal.findMany({
    where: { merchantId: merchant.id },
    orderBy: { startsAt: "desc" },
    include: {
      _count: { select: { redemptions: true } },
    },
  });

  const dealsWithStatus = deals.map((deal) => ({
    ...deal,
    status: getDealStatus(deal),
  }));

  const totalDeals = dealsWithStatus.length;
  const activeDeals = dealsWithStatus.filter(
    (d) => d.status === "ACTIVE",
  ).length;
  const upcomingDeals = dealsWithStatus.filter(
    (d) => d.status === "UPCOMING",
  ).length;
  const endedDeals = dealsWithStatus.filter(
    (d) => d.status === "ENDED",
  ).length;

  const totalRedemptions = await prisma.redemption.count({
    where: {
      deal: { merchantId: merchant.id },
    },
  });

  const totalSavingsOffered = dealsWithStatus.reduce((sum, deal) => {
    const original = deal.originalPrice ?? 0;
    const discount = deal.discountValue ?? 0;
    if (!original || !discount) return sum;

    // Approx: savings per redemption * number of redemptions
    const savingsPerRedemption = Math.round((original * discount) / 100);
    const redemptions = (deal as any)._count?.redemptions ?? 0;
    return sum + savingsPerRedemption * redemptions;
  }, 0);

  // Recent deals list (top 3)
  const recentDeals = dealsWithStatus.slice(0, 3);

  const initials = merchant.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // 3) Profile completion
  const importantFields = [
    merchant.avatarUrl,
    merchant.description,
    merchant.category,
    merchant.city,
    merchant.address,
    merchant.phone,
    merchant.website,
  ];

  const filledCount = importantFields.filter(
    (v) => !!v && String(v).trim() !== "",
  ).length;

  const totalCount = importantFields.length;
  const completion = Math.round((filledCount / totalCount) * 100) || 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {/* Header with title + quick actions */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
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

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/merchant/deals/new"
            className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            + Create new deal
          </Link>
          <Link
            href="/merchant/deals"
            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View my deals
          </Link>
          <Link
            href="/merchant/profile/edit"
            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit profile
          </Link>
        </div>
      </header>

      {/* KPI cards row */}
      <section className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Active deals</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {activeDeals}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {totalDeals > 0
              ? `${upcomingDeals} upcoming · ${endedDeals} ended`
              : "Create your first deal to get started."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total deals</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {totalDeals}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Includes all active, upcoming and ended deals.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">
            Total redemptions
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {totalRedemptions}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Number of times customers have redeemed your deals.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Savings offered</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            ₦{totalSavingsOffered.toLocaleString("en-NG")}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Estimated value of discounts you&apos;ve made available.
          </p>
        </div>
      </section>

      {/* Main layout: profile summary + status/completion + recent deals */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)]">
        {/* Left: profile card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          {/* Banner */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />

          <div className="px-6 pb-8 pt-6 sm:px-10">
            {/* Top row: avatar + name */}
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 shadow-sm">
                  {merchant.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={merchant.avatarUrl}
                      alt={merchant.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-base font-semibold text-slate-500">
                      {initials || "Logo"}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-900">
                      {merchant.name}
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Active on Dealina
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {merchant.category && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                        {merchant.category}
                      </span>
                    )}
                    {merchant.city && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                        {merchant.city}
                      </span>
                    )}
                  </div>

                  {merchant.website && (
                    <div className="text-xs text-emerald-700">
                      <a
                        href={merchant.website}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {merchant.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 text-right text-[11px] text-slate-500">
                <span className="uppercase tracking-wide text-slate-400">
                  Profile ID
                </span>
                <span className="rounded-full bg-slate-50 px-3 py-1 font-mono text-[10px] text-slate-600">
                  {merchant.id.slice(0, 8)}••••
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="mt-6 border-t border-slate-100" />

            {/* About + contact + location */}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  About this business
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {merchant.description ||
                    "No description yet. Tell customers what you offer, your style, and why they should choose you."}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact
                </h3>
                <dl className="mt-3 space-y-2 text-sm text-slate-700">
                  <div>
                    <dt className="text-xs text-slate-500">Phone</dt>
                    <dd>
                      {merchant.phone || (
                        <span className="text-slate-400">
                          No phone added yet.
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Email</dt>
                    <dd>{user?.email ?? "—"}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location
                </h3>
                <dl className="mt-3 space-y-2 text-sm text-slate-700">
                  <div>
                    <dt className="text-xs text-slate-500">Address</dt>
                    <dd>
                      {merchant.address || (
                        <span className="text-slate-400">
                          Add a street address or area so customers know where
                          you are.
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">City</dt>
                    <dd>
                      {merchant.city || (
                        <span className="text-slate-400">City not set.</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <p className="mt-8 text-xs text-slate-400">
              You can change your logo and details on the{" "}
              <Link
                href="/merchant/profile/edit"
                className="font-medium text-emerald-600 hover:underline"
              >
                Edit profile
              </Link>{" "}
              page.
            </p>
          </div>
        </div>

        {/* Right: status + completion + recent deals */}
        <aside className="space-y-4">
          {/* Profile status + completion */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Profile status
            </h3>

            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]" />
              <span className="font-medium text-slate-900">
                Visible on deals
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Customers see this information on every deal you publish. Keeping
              your profile updated increases trust and conversions.
            </p>

            {/* Completion meter */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Profile completion</span>
                <span className="font-medium text-slate-700">
                  {completion}%
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                  style={{ width: `${Math.max(completion, 6)}%` }}
                />
              </div>

              {completion < 100 && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Complete your description, logo, contact and location details
                  so customers clearly understand your business.
                </p>
              )}
            </div>
          </div>

          {/* Recent deals */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recent deals
            </h3>

            {recentDeals.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                You haven&apos;t created any deals yet.{" "}
                <Link
                  href="/merchant/deals/new"
                  className="font-medium text-emerald-600 hover:underline"
                >
                  Create your first deal
                </Link>{" "}
                to start attracting customers.
              </p>
            ) : (
              <ul className="mt-3 space-y-3 text-xs">
                {recentDeals.map((deal) => (
                  <li
                    key={deal.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">
                        {deal.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Starts{" "}
                        {deal.startsAt.toLocaleDateString("en-NG")} ·{" "}
                        {deal.discountValue
                          ? `${deal.discountValue}% OFF`
                          : "No discount set"}
                      </p>
                    </div>
                    <span
                      className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        deal.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : deal.status === "UPCOMING"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {deal.status === "ACTIVE"
                        ? "Active"
                        : deal.status === "UPCOMING"
                        ? "Upcoming"
                        : "Ended"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick links */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Quick links
            </h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link
                  href="/merchant/deals/new"
                  className="text-emerald-700 hover:underline"
                >
                  • Create a new deal
                </Link>
              </li>
              <li>
                <Link
                  href="/merchant/deals"
                  className="text-emerald-700 hover:underline"
                >
                  • Manage my existing deals
                </Link>
              </li>
              <li>
                <Link
                  href="/merchant/profile/edit"
                  className="text-emerald-700 hover:underline"
                >
                  • Edit my merchant profile
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
