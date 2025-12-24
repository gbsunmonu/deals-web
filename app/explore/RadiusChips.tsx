// app/explore/RadiusChips.tsx
"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const RADII = [2, 5, 10] as const;

function first(v: string | string[] | null) {
  return Array.isArray(v) ? v[0] : v;
}

export default function RadiusChips({ className = "" }: { className?: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const sort = sp.get("sort") || "";
  const lat = sp.get("lat");
  const lng = sp.get("lng");

  const radiusRaw = first(sp.get("r"));
  const radius = radiusRaw ? Number(radiusRaw) : null;

  const isNearby = sort === "nearby";
  const hasCoords = !!lat && !!lng;

  const activeRadius = useMemo(() => {
    if (!isNearby) return null;
    if (!radius || !Number.isFinite(radius)) return null;
    return RADII.includes(radius as any) ? radius : null;
  }, [isNearby, radius]);

  function setRadius(r: number | null) {
    // preserve existing params
    const qs = new URLSearchParams(sp.toString());

    if (!isNearby) qs.set("sort", "nearby");

    // nearby needs coords; if missing, just push without radius (NearbyButton will set coords)
    if (!hasCoords) {
      qs.delete("r");
      router.push(`/explore?${qs.toString()}`);
      return;
    }

    if (r == null) qs.delete("r");
    else qs.set("r", String(r));

    router.push(`/explore?${qs.toString()}`);
  }

  if (!isNearby) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-semibold text-slate-500">Radius:</span>

      <button
        type="button"
        onClick={() => setRadius(null)}
        className={[
          "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
          activeRadius == null
            ? "bg-slate-900 text-white ring-slate-900"
            : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
        ].join(" ")}
        title="Show all nearby results"
      >
        Any
      </button>

      {RADII.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRadius(r)}
          className={[
            "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
            activeRadius === r
              ? "bg-emerald-600 text-white ring-emerald-600"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
          ].join(" ")}
          title={`Show deals within ${r}km`}
        >
          {r}km
        </button>
      ))}
    </div>
  );
}
