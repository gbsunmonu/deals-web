// app/explore/page.tsx
import { prisma } from "@/lib/prisma";
import ExploreClient from "./ExploreClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = Record<string, string | string[] | undefined>;
type ExplorePageProps = { searchParams?: SP } | { searchParams?: Promise<SP> };

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function parseNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeDiscountPct(discountType: string, discountValue: number) {
  if (String(discountType) !== "PERCENT") return 0;
  return clampPct(Number(discountValue ?? 0));
}

/** Haversine distance (km) */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseRadiusKm(v: unknown) {
  const x = Number(v);
  if (!Number.isFinite(x)) return null;
  if (x === 2 || x === 5 || x === 10) return x;
  return null;
}

export default async function ExplorePage(props: ExplorePageProps) {
  const sp: SP =
    props.searchParams instanceof Promise
      ? await props.searchParams
      : (props.searchParams ?? {});

  const sort = (first(sp.sort) || "").toLowerCase(); // "", "hot", "nearby"
  const lat = parseNum(first(sp.lat));
  const lng = parseNum(first(sp.lng));
  const radiusKm = parseRadiusKm(first(sp.r)) ?? 5;

  const hasUserLocation =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  // Load deals (+ createdAt + merchant lat/lng)
  const deals = await prisma.deal.findMany({
    where: { endsAt: { gte: now } },
    orderBy: { createdAt: "desc" },
    take: 120,
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
      createdAt: true,
      merchant: {
        select: { id: true, name: true, city: true, lat: true, lng: true },
      },
    },
  });

  const dealIds = deals.map((d) => d.id);

  // Banner stats
  const activeDeals = await prisma.deal.count({
    where: { startsAt: { lte: now }, endsAt: { gte: now } },
  });

  const highestDiscountPct =
    deals.length === 0
      ? 0
      : Math.max(
          ...deals.map((d) =>
            computeDiscountPct(String(d.discountType), Number(d.discountValue ?? 0))
          )
        );

  // Hot signals (7d)
  const [viewsByDeal, redeemedByDeal] = await Promise.all([
    dealIds.length
      ? prisma.event.groupBy({
          by: ["dealId"],
          where: {
            type: "DEAL_VIEW",
            dealId: { in: dealIds },
            createdAt: { gte: weekStart, lte: now },
          },
          _count: { _all: true },
        })
      : Promise.resolve([] as any[]),

    dealIds.length
      ? prisma.redemption.groupBy({
          by: ["dealId"],
          where: {
            dealId: { in: dealIds },
            redeemedAt: { not: null, gte: weekStart, lte: now },
          },
          _count: { _all: true },
        })
      : Promise.resolve([] as any[]),
  ]);

  const viewMap = new Map<string, number>();
  for (const r of viewsByDeal) if (r.dealId) viewMap.set(r.dealId, r._count._all);

  const redeemMap = new Map<string, number>();
  for (const r of redeemedByDeal) if (r.dealId) redeemMap.set(r.dealId, r._count._all);

  // Enrich + score
  const enriched = deals.map((d) => {
    const views = viewMap.get(d.id) ?? 0;
    const redeemed = redeemMap.get(d.id) ?? 0;

    const pct = computeDiscountPct(String(d.discountType), Number(d.discountValue ?? 0));
    const redeemRate = views > 0 ? redeemed / views : 0;

    const hot = pct >= 40 || (views >= 5 && (redeemed >= 1 || redeemRate >= 0.25));

    const mLat = typeof d.merchant?.lat === "number" ? d.merchant.lat : null;
    const mLng = typeof d.merchant?.lng === "number" ? d.merchant.lng : null;

    const dist =
      hasUserLocation && mLat != null && mLng != null
        ? distanceKm(lat!, lng!, mLat, mLng)
        : null;

    const msLeft = new Date(d.endsAt).getTime() - now.getTime();
    const endsSoonFactor =
      msLeft <= 0
        ? 0
        : msLeft <= 24 * 60 * 60 * 1000
        ? 1 - msLeft / (24 * 60 * 60 * 1000)
        : 0;

    const distancePenalty = dist == null ? 9999 : dist;

    const discountBonusKm = Math.min(1.2, pct / 80);
    const hotBonusKm = hot ? 0.8 : 0;
    const endsSoonBonusKm = endsSoonFactor * 0.4;

    const nearbyScore = distancePenalty - discountBonusKm - hotBonusKm - endsSoonBonusKm;

    return { ...d, hot, distanceKm: dist, nearbyScore };
  });

  // Radius filter (only in nearby mode)
  let filtered = enriched;
  if (sort === "nearby") {
    filtered = enriched.filter((d) => {
      if (!hasUserLocation) return true; // if no location, don’t filter everything out
      if (d.distanceKm == null) return false;
      return d.distanceKm <= radiusKm;
    });
  }

  // Sorting
  let sorted = filtered;

  if (sort === "nearby") {
    sorted = [...filtered].sort((a, b) => {
      // primary: distance (closest first). If missing, bottom.
      const ad = a.distanceKm ?? 9999;
      const bd = b.distanceKm ?? 9999;
      if (ad !== bd) return ad - bd;

      // secondary: higher discount
      const aPct = computeDiscountPct(String(a.discountType), Number(a.discountValue ?? 0));
      const bPct = computeDiscountPct(String(b.discountType), Number(b.discountValue ?? 0));
      if (aPct !== bPct) return bPct - aPct;

      // tertiary: hot
      if (a.hot !== b.hot) return a.hot ? -1 : 1;

      // newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } else if (sort === "hot") {
    sorted = [...filtered].sort((a, b) => {
      if (a.hot !== b.hot) return a.hot ? -1 : 1;

      const aPct = computeDiscountPct(String(a.discountType), Number(a.discountValue ?? 0));
      const bPct = computeDiscountPct(String(b.discountType), Number(b.discountValue ?? 0));
      if (aPct !== bPct) return bPct - aPct;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } else {
    sorted = [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  return (
    <ExploreClient
      deals={sorted as any}
      bannerStats={{ activeDeals, highestDiscountPct }}
    />
  );
}
