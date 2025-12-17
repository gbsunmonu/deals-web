"use client";

import { useMemo } from "react";
import DealCard from "@/components/DealCard";
import { useAvailabilityMap } from "@/components/useAvailabilityMap";

export default function ExploreClient({ deals }: { deals: any[] }) {
  const ids = useMemo(() => deals.map((d) => d.id), [deals]);
  const { map } = useAvailabilityMap(ids, { intervalMs: 5000 });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Explore deals</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live availability updates automatically.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} availability={map[deal.id]} />
        ))}
      </section>

      {deals.length === 0 && (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No deals found.
        </div>
      )}
    </main>
  );
}
