// app/explore/NearbyEmptyState.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function parseRadius(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n === 2 || n === 5 || n === 10) return n;
  return null;
}

function toKmLabel(n: number) {
  return `${n}km`;
}

type Counts = { 2: number; 5: number; 10: number };

export default function NearbyEmptyState({ className = "" }: { className?: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const sort = sp.get("sort") || "";
  const lat = sp.get("lat");
  const lng = sp.get("lng");
  const r = parseRadius(sp.get("r"));

  const isNearby = sort === "nearby";
  const hasCoords = !!lat && !!lng;

  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);

  // Only run in Nearby with coords + radius
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isNearby || !hasCoords || r == null) return;

      setLoading(true);
      try {
        const res = await fetch(`/api/explore/nearby-counts?lat=${encodeURIComponent(lat!)}&lng=${encodeURIComponent(lng!)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));

        if (!cancelled && res.ok && data?.counts) {
          setCounts(data.counts as Counts);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isNearby, hasCoords, r, lat, lng]);

  const suggestions = useMemo(() => {
    if (!isNearby || !hasCoords || r == null) return [];

    // Default fallback if counts not loaded yet
    const base =
      r === 2 ? [5, 10] :
      r === 5 ? [10] :
      [];

    // If counts loaded, only suggest radii that actually have results
    if (!counts) return base;

    const candidates =
      r === 2 ? [5, 10] :
      r === 5 ? [10] :
      [];

    return candidates.filter((nr) => (counts as any)[nr] > 0);
  }, [isNearby, hasCoords, r, counts]);

  function pushWithRadius(nextRadius: number | null) {
    const qs = new URLSearchParams(sp.toString());
    qs.set("sort", "nearby");

    if (nextRadius == null) qs.delete("r");
    else qs.set("r", String(nextRadius));

    router.push(`/explore?${qs.toString()}`);
  }

  if (!isNearby || !hasCoords || r == null) return null;

  const countLabel = (nr: 2 | 5 | 10) => {
    if (!counts) return "";
    const n = counts[nr] ?? 0;
    return ` (${n.toLocaleString("en-NG")})`;
  };

  return (
    <div
      className={[
        "mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
        className,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            No deals within {toKmLabel(r)}.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {loading
              ? "Checking nearby areas…"
              : counts
              ? "Try expanding your radius to see more nearby deals."
              : "Try expanding your radius."}
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          📍 Nearby
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {/* Suggestions that actually have results (when counts loaded) */}
        {suggestions.map((nr) => (
          <button
            key={nr}
            type="button"
            onClick={() => pushWithRadius(nr)}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Expand to {toKmLabel(nr)}
            {counts ? countLabel(nr as any) : ""}
          </button>
        ))}

        {/* If counts loaded and nothing suggested, still allow user to expand anyway */}
        {counts && suggestions.length === 0 && r !== 10 ? (
          <button
            type="button"
            onClick={() => pushWithRadius(r === 2 ? 5 : 10)}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Expand radius
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => pushWithRadius(null)}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Show Any
        </button>
      </div>

      {counts ? (
        <div className="mt-3 text-xs text-slate-500">
          Within 2km: <span className="font-semibold text-slate-700">{counts[2]}</span> ·{" "}
          5km: <span className="font-semibold text-slate-700">{counts[5]}</span> ·{" "}
          10km: <span className="font-semibold text-slate-700">{counts[10]}</span>
        </div>
      ) : null}
    </div>
  );
}
