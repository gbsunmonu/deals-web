// app/explore/page.tsx
import Link from "next/link";
import prisma from "@/lib/prisma";
import ExploreGridClient from "./ExploreGridClient";

type ExplorePageProps = {
  searchParams?: Promise<{
    q?: string;
    category?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isPercent(discountType: any) {
  return discountType === "PERCENT" || discountType === "PERCENTAGE";
}

function computeSaveAmount(
  originalPrice: number | null,
  discountValue: number,
  discountType: any
) {
  const pct = clampPct(Number(discountValue ?? 0));
  if (!originalPrice || pct <= 0 || !isPercent(discountType)) return null;
  return Math.round((originalPrice * pct) / 100);
}

// ✅ HOT DEAL RULE: save >= ₦1000 OR discount >= 45%
function computeIsHotDeal(
  originalPrice: number | null,
  discountValue: number,
  discountType: any
) {
  const pct = clampPct(Number(discountValue ?? 0));
  const save = computeSaveAmount(originalPrice, pct, discountType);
  return (save != null && save >= 1000) || pct >= 45;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim();
  const category = (params.category ?? "").trim();

  const now = new Date();

  const [liveDealsCount, startingSoonCount, topDiscountAgg] = await Promise.all([
    prisma.deal.count({
      where: { startsAt: { lte: now }, endsAt: { gte: now } },
    }),
    prisma.deal.count({
      where: { startsAt: { gt: now } },
    }),
    prisma.deal.aggregate({
      _max: { discountValue: true },
      where: { startsAt: { lte: now }, endsAt: { gte: now } },
    }),
  ]);

  const topDiscountValue = topDiscountAgg._max.discountValue ?? 0;

  const categoryRows = await prisma.merchant.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  const categories = categoryRows
    .map((c) => c.category)
    .filter((c): c is string => !!c);

  const deals = await prisma.deal.findMany({
    where: {
      startsAt: { lte: now },
      endsAt: { gte: now },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { merchant: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(category ? { merchant: { category } } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      originalPrice: true,
      discountValue: true,
      discountType: true,
      startsAt: true,
      endsAt: true,
      imageUrl: true,
      maxRedemptions: true,
      merchant: { select: { id: true, name: true, city: true } },
    },
    orderBy: { startsAt: "desc" },
  });

  // ✅ HOT FIRST SORT (server-side)
  const sortedDeals = [...deals].sort((a, b) => {
    const aHot = computeIsHotDeal(
      a.originalPrice ?? null,
      a.discountValue,
      a.discountType
    );
    const bHot = computeIsHotDeal(
      b.originalPrice ?? null,
      b.discountValue,
      b.discountType
    );
    if (aHot !== bHot) return aHot ? -1 : 1;

    const aPct = clampPct(a.discountValue);
    const bPct = clampPct(b.discountValue);
    if (aPct !== bPct) return bPct - aPct;

    return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* HERO BANNER */}
      <section className="mb-6 rounded-3xl bg-gradient-to-r from-fuchsia-600 via-violet-500 to-emerald-500 p-5 md:p-6 text-white shadow-[0_18px_40px_rgba(60,0,120,0.30)]">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] md:items-center">
          <div className="space-y-2 md:space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] opacity-80">
              Yes to Deals
            </p>

            <h1 className="text-xl font-semibold leading-snug md:text-2xl lg:text-[26px]">
              Save on local deals near you — no account needed
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-white/90">
              Find discounts from nearby salons, barbers, food spots and more.
              Tap any card to see full details, pricing, and your Yes to Deals QR
              code for redemption.
            </p>

            <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
              1. Pick a deal • 2. Get a QR code • 3. Show it in store to redeem
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-3 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                Live deals today
              </p>
              <p className="mt-1 text-xl font-semibold">
                {liveDealsCount.toLocaleString("en-NG")}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-white/80">
                Available to redeem with a QR code.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                Starting soon
              </p>
              <p className="mt-1 text-xl font-semibold">
                {startingSoonCount.toLocaleString("en-NG")}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-white/80">
                Upcoming promotions already planned.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                Top discount today
              </p>
              <p className="mt-1 text-xl font-semibold">
                {topDiscountValue > 0 ? `${topDiscountValue}% OFF` : "—"}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-white/80">
                Highest percentage off among live deals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEARCH + FILTERS */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <form className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex-1">
            <label
              htmlFor="q"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Search deals
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Search by deal or merchant name…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="w-full md:w-52">
            <label
              htmlFor="category"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={category}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Apply
            </button>

            {(q || category) && (
              <Link
                href="/explore"
                className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* DEAL GRID */}
      <ExploreGridClient deals={sortedDeals as any} />
    </main>
  );
}
