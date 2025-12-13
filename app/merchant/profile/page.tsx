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
  // ✅ FIX: await because createSupabaseServer() is async
  const supabase = await createSupabaseServer();

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
      if ((error as any).name === "AuthSessionMissingError") {
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
  const activeDeals = dealsWithStatus.filter((d) => d.status === "ACTIVE").length;
  const upcomingDeals = dealsWithStatus.filter((d) => d.status === "UPCOMING").length;
  const endedDeals = dealsWithStatus.filter((d) => d.status === "ENDED").length;

  const totalRedemptions = await prisma.redemption.count({
    where: {
      deal: { merchantId: merchant.id },
    },
  });

  const totalSavingsOffered = dealsWithStatus.reduce((sum, deal) => {
    const original = deal.originalPrice ?? 0;
    const discount = deal.discountValue ?? 0;
    if (!original || !discount) return sum;

    const savingsPerRedemption = Math.round((original * discount) / 100);
    const redemptions = (deal as any)._count?.redemptions ?? 0;
    return sum + savingsPerRedemption * redemptions;
  }, 0);

  const recentDeals = dealsWithStatus.slice(0, 3);

  const initials = merchant.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const importantFields = [
    merchant.avatarUrl,
    merchant.description,
    merchant.category,
    merchant.city,
    merchant.address,
    merchant.phone,
    merchant.website,
  ];

  const filledCount = importantFields.filter((v) => !!v && String(v).trim() !== "").length;
  const totalCount = importantFields.length;
  const completion = Math.round((filledCount / totalCount) * 100) || 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-500">
            MERCHANT
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            Merchant home
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            This is your main dashboard. Keep your details up to date and track how your deals are doing.
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

      <section className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Active deals</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{activeDeals}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {totalDeals > 0 ? `${upcomingDeals} upcoming · ${endedDeals} ended` : "Create your first deal to get started."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total deals</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{totalDeals}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Includes all active, upcoming and ended deals.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total redemptions</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{totalRedemptions}</p>
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

      {/* (rest of your JSX unchanged from what you already have) */}
      {/* Keep the rest as-is to avoid UI regressions */}
      {/* ... */}
    </main>
  );
}
