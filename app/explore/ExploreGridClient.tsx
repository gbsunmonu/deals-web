"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DealCard from "@/components/DealCard";
import type { AvailabilityRow } from "@/components/AvailabilityBadge";

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
};

type AvailabilityMap = Record<string, AvailabilityRow>;

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeSaveAmount(deal: DealRow) {
  const discountValue = clampPct(Number(deal.discountValue ?? 0));
  const originalPrice = typeof deal.originalPrice === "number" ? deal.originalPrice : null;
  const isPercent = deal.discountType === "PERCENT" || deal.discountType === "PERCENTAGE";

  if (!originalPrice || discountValue <= 0 || !isPercent) return null;
  return Math.round((originalPrice * discountValue) / 100);
}

function hotScore(deal: DealRow) {
  const discountValue = clampPct(Number(deal.discountValue ?? 0));
  const saveAmount = computeSaveAmount(deal);

  const isHot = (saveAmount != null && saveAmount >= 1000) || discountValue >= 45;
  if (!isHot) return 0;

  // higher score => earlier in list
  // prioritize huge savings, then high %.
  return (saveAmount ?? 0) + discountValue * 50;
}

export default function ExploreGridClient({ deals }: { deals: DealRow[] }) {
  // ✅ Sort HOT deals first (client-side)
  const sortedDeals = useMemo(() => {
    const arr = [...deals];
    arr.sort((a, b) => {
      const hs = hotScore(b) - hotScore(a);
      if (hs !== 0) return hs;

      // fallback: newest first (startsAt desc)
      const aS = new Date(a.startsAt as any).getTime();
      const bS = new Date(b.startsAt as any).getTime();
      return bS - aS;
    });
    return arr;
  }, [deals]);

  const ids = useMemo(() => sortedDeals.map((d) => d.id), [sortedDeals]);

  const [map, setMap] = useState<AvailabilityMap>({});
  const [pulseKey, setPulseKey] = useState<Record<string, number>>({});

  const prevRef = useRef<AvailabilityMap>({});
  const timerRef = useRef<any>(null);

  async function fetchAvailability() {
    if (!ids.length) return;

    const res = await fetch("/api/deals/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;

    const nextMap = (data?.map || {}) as AvailabilityMap;

    const prev = prevRef.current;
    const nextPulse: Record<string, number> = { ...pulseKey };

    for (const id of ids) {
      const a = prev[id];
      const b = nextMap[id];
      if (!b) continue;

      const changed =
        !a ||
        a.soldOut !== b.soldOut ||
        (a.left ?? null) !== (b.left ?? null) ||
        (a.redeemedCount ?? 0) !== (b.redeemedCount ?? 0);

      if (changed) nextPulse[id] = (nextPulse[id] || 0) + 1;
    }

    prevRef.current = nextMap;
    setPulseKey(nextPulse);
    setMap(nextMap);
  }

  useEffect(() => {
    fetchAvailability();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchAvailability, 5000); // ✅ polling interval
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  return (
    <section aria-label="Live deals">
      {sortedDeals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          No deals match your search yet. Try clearing filters or checking back later.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedDeals.map((deal) => {
            const availability = map[deal.id]; // can be undefined at first load

            return (
              <DealCard
                key={deal.id}
                deal={deal}
                merchant={deal.merchant}
                availability={availability}
                availabilityPulseKey={pulseKey[deal.id] || 0}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
