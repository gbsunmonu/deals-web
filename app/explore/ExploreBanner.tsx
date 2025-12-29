"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NearbyButton from "./NearbyButton";


type Props = {
  activeDeals?: number;
  highestDiscountPct?: number;
};

const RADII = ["2", "5", "10"] as const;

export default function ExploreBanner({
  activeDeals = 0,
  highestDiscountPct = 0,
}: Props) {
  const safeActive = Number.isFinite(activeDeals) ? activeDeals : 0;
  const safePct = Number.isFinite(highestDiscountPct) ? highestDiscountPct : 0;

  const router = useRouter();
  const sp = useSearchParams();

  const sort = (sp.get("sort") || "").toLowerCase();
  const r = sp.get("r") || "5";

  function setRadius(nextR: string) {
    const qs = new URLSearchParams(sp.toString());
    qs.set("r", nextR);
    router.push(`/explore?${qs.toString()}`);
  }

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative">
        <div className="h-36 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.6),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,.5),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(255,255,255,.35),transparent_50%)]" />

        <div className="absolute inset-0 flex items-end">
          <div className="w-full px-5 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
              Explore deals near you
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Save money at local stores — instantly.
            </h1>
            <p className="mt-1 text-sm text-white/85">
              Tap a deal, generate a QR, and redeem at checkout.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Active deals
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {safeActive.toLocaleString("en-NG")}
            </p>
            <p className="mt-1 text-xs text-slate-500">Live right now</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Highest discount
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {safePct > 0 ? `${safePct}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Best deal today</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          {/* Toggle chips */}
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Link
              href="/explore?sort=hot"
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-slate-200 transition",
                sort === "hot" ? "bg-slate-900 text-white" : "bg-white text-slate-900 hover:bg-slate-50",
              ].join(" ")}
            >
              🔥 Hot
            </Link>

            <NearbyButton />
          </div>

          {/* Radius chips (only when Nearby is active) */}
          {sort === "nearby" ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="text-xs font-semibold text-slate-500">Radius:</span>
              {RADII.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setRadius(x)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
                    r === x
                      ? "bg-emerald-600 text-white ring-emerald-600"
                      : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {x} km
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
