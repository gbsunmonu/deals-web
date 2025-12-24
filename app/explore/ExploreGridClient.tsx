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
  // optional for nearby sorting
  distanceKm?: number | null;
};

type AvailabilityMap = Record<string, AvailabilityRow>;

export default function ExploreGridClient({ deals }: { deals?: DealRow[] }) {
  // ✅ hard default to prevent crashes
  const safeDeals = Array.isArray(deals) ? deals : [];

  const ids = useMemo(() => safeDeals.map((d) => d.id), [safeDeals]);

  const [map, setMap] = useState<AvailabilityMap>({});
  const [pulseKey, setPulseKey] = useState<Record<string, number>>({});

  const prevRef = useRef<AvailabilityMap>({});
  const esRef = useRef<EventSource | null>(null);

  function applyIncoming(partial: AvailabilityMap) {
    const prev = prevRef.current;
    const nextPulse: Record<string, number> = { ...pulseKey };

    for (const id of Object.keys(partial || {})) {
      const a = prev[id];
      const b = partial[id];
      if (!b) continue;

      const changed =
        !a ||
        a.soldOut !== b.soldOut ||
        (a.left ?? null) !== (b.left ?? null) ||
        (a.redeemedCount ?? 0) !== (b.redeemedCount ?? 0) ||
        (a.maxRedemptions ?? null) !== (b.maxRedemptions ?? null);

      if (changed) nextPulse[id] = (nextPulse[id] || 0) + 1;
    }

    prevRef.current = { ...prev, ...(partial || {}) };
    setPulseKey(nextPulse);
    setMap((m) => ({ ...m, ...(partial || {}) }));
  }

  async function fallbackFetchOnce() {
    if (!ids.length) return;

    try {
      const res = await fetch("/api/deals/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;

      const nextMap = (data?.map || {}) as AvailabilityMap;
      if (nextMap && typeof nextMap === "object") applyIncoming(nextMap);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // close previous SSE
    if (esRef.current) {
      try {
        esRef.current.close();
      } catch {
        // ignore
      }
      esRef.current = null;
    }

    // prime UI quickly
    fallbackFetchOnce();

    if (!ids.length) return;

    const qs = encodeURIComponent(ids.join(","));
    const es = new EventSource(`/api/deals/availability/stream?ids=${qs}`);
    esRef.current = es;

    es.addEventListener("availability", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data || "{}");
        const partial = (data?.map || {}) as AvailabilityMap;
        if (partial && typeof partial === "object") applyIncoming(partial);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("error", () => {
      // If SSE fails, do a one-time fetch so UI doesn't break.
      fallbackFetchOnce();
    });

    return () => {
      try {
        es.close();
      } catch {
        // ignore
      }
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  return (
    <section aria-label="Live deals">
      {safeDeals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          No deals match your search yet. Try clearing filters or checking back later.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {safeDeals.map((deal) => {
            const availability = map[deal.id]; // undefined initially is fine

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
