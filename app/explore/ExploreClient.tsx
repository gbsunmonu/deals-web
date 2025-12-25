// app/explore/ExploreClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ExploreBanner from "./ExploreBanner";
import ExploreGridClient from "./ExploreGridClient";
import NearbyEmptyState from "./NearbyEmptyState";

type DealRow = {
  id: string;
  title: string;
  description: string | null;
  originalPrice: number | null;
  discountValue: number;
  discountType: string;
  startsAt: Date | string;
  endsAt: Date | string;
  imageUrl: string | null;
  maxRedemptions: number | null;
  merchant: { id: string; name: string; city: string | null };
  distanceKm?: number | null;
  hot?: boolean;
};

type BannerStats = {
  activeDeals: number;
  highestDiscountPct: number;
};

export default function ExploreClient({
  deals,
  bannerStats,
}: {
  deals?: DealRow[];
  bannerStats?: Partial<BannerStats> | null;
}) {
  const sp = useSearchParams();

  const safeDeals = Array.isArray(deals) ? deals : [];

  const safeBanner = useMemo(
    () => ({
      activeDeals: Number(bannerStats?.activeDeals ?? safeDeals.length) || 0,
      highestDiscountPct: Number(bannerStats?.highestDiscountPct ?? 0) || 0,
    }),
    [bannerStats?.activeDeals, bannerStats?.highestDiscountPct, safeDeals.length]
  );

  const [q, setQ] = useState("");

  const filteredDeals = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return safeDeals;

    return safeDeals.filter((d) => {
      const hay = `${d.title} ${d.description ?? ""} ${d.merchant?.name ?? ""} ${
        d.merchant?.city ?? ""
      }`.toLowerCase();
      return hay.includes(term);
    });
  }, [q, safeDeals]);

  // ✅ only show Nearby empty message when:
  // - sort=nearby
  // - has lat/lng in URL (NearbyButton puts them)
  // - has r radius
  // - results are empty (after filtering)
  const sort = (sp.get("sort") || "").toLowerCase();
  const hasCoords = !!sp.get("lat") && !!sp.get("lng");
  const hasRadius = !!sp.get("r");
  const showNearbyEmpty = sort === "nearby" && hasCoords && hasRadius && filteredDeals.length === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <ExploreBanner
        activeDeals={safeBanner.activeDeals}
        highestDiscountPct={safeBanner.highestDiscountPct}
      />

      {/* Search */}
      <div className="mb-4 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search deals or merchants…"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        ) : null}
      </div>

      {/* ✅ Nearby empty-state w/ "Expand radius (count)" chips */}
      {showNearbyEmpty ? <NearbyEmptyState /> : null}

      <ExploreGridClient deals={filteredDeals} />
    </main>
  );
}
