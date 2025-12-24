// app/explore/page.tsx
import { prisma } from "@/lib/prisma";
import ExploreClient from "./ExploreClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = Record<string, string | string[] | undefined>;

type ExplorePageProps =
  | { searchParams?: SP }
  | { searchParams?: Promise<SP> };

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeDiscountPct(discountType: string, discountValue: number) {
  if (String(discountType) !== "PERCENT") return 0;
  return clampPct(Number(discountValue ?? 0));
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function parseNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseRadiusKm(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n === 2 || n === 5 || n === 10) return n;
  return null;
}

/**
 * Haversine distance (km)
 */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default async function ExplorePage(props: ExplorePageProps) {
  const sp: SP =
    props.searchParams instanceof Promise
      ? await props.searchParams
      : props.searchParams ?? {};

  const sort = (first(sp.sort) || "").toLowerCase(); // "", "hot", "nearby"
  const lat = parseNum(first(sp.lat));
  const lng = parseNum(first(sp.lng));
  const radiusKm = parseRadiusKm(first(sp.r));

  const hasUserLocation =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

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
        select: {
          id: true,
          name: true,
          city: true,
          lat: true,
          lng: true,
        },
      },
    },
  });

  const dealIds = deals.map((d) => d.id);

  const activeDeals = await prisma.deal.count({
    where: { startsAt: { lte: now }, endsAt: { gte: now } },
  });

  const highestDiscountPct =
    deals.length === 0
      ? 0
      : Math.max(
          ...deals.map((d) =>
            computeDiscountPct(d.discountType, d.discountValue ?? 0)
          )
        );

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
      : [],
    dealIds.length
      ? prisma.redemption.groupBy({
          by: ["dealId"],
          where: {
            dealId: { in: dealIds },
            redeemedAt: { not: null, gte: weekStart, lte: now },
          },
          _count: { _all: true },
        })
      : [],
  ]);

  const viewMap = new Map<string, number>();
  viewsByDeal.forEach((r) => r.dealId && viewMap.set(r.dealId, r._count._all));

  const redeemMap = new Map<string, number>();
  redeemedByDeal.forEach(
    (r) => r.dealId && redeemMap.set(r.dealId, r._count._all)
  );

  // enrich
  let enriched = deals.map((d) => {
    const views = viewMap.get(d.id) ?? 0;
    const redeemed = redeemMap.get(d.id) ?? 0;

    const pct = computeDiscountPct(d.discountType, d.discountValue ?? 0);
    const redeemRate = views > 0 ? redeemed / views : 0;

    const hot =
      pct >= 40 || (views >= 5 && (redeemed >= 1 || redeemRate >= 0.25));

    const mLat = d.merchant?.lat;
    const mLng = d.merchant?.lng;

    const dist =
      hasUserLocation && typeof mLat === "number" && typeof mLng === "number"
        ? distanceKm(lat!, lng!, mLat, mLng)
        : null;

    const msLeft = new Date(d.endsAt).getTime() - now.getTime();
    const endsSoonFactor =
      msLeft > 0 && msLeft <= 86400000 ? 1 - msLeft / 86400000 : 0;

    const nearbyScore =
      (dist ?? 9999) -
      Math.min(1.2, pct / 80) -
      (hot ? 0.8 : 0) -
      endsSoonFactor * 0.4;

    return {
      ...d,
      hot,
      distanceKm: dist,
      nearbyScore,
    };
  });

  // ✅ Radius filter (ONLY in nearby mode, ONLY if we have coords)
  if (sort === "nearby" && hasUserLocation && radiusKm != null) {
    enriched = enriched.filter((d) => d.distanceKm != null && d.distanceKm <= radiusKm);
  }

  // sorting
  let sorted = enriched;

  if (sort === "nearby") {
    sorted = [...enriched].sort((a, b) => {
      if (a.nearbyScore !== b.nearbyScore) return a.nearbyScore - b.nearbyScore;

      // ✅ distance tie-break (smaller distance wins)
      const ad = a.distanceKm ?? 9999;
      const bd = b.distanceKm ?? 9999;
      if (ad !== bd) return ad - bd;

      // then discount, then hot, then newest
      const aPct = computeDiscountPct(a.discountType, a.discountValue ?? 0);
      const bPct = computeDiscountPct(b.discountType, b.discountValue ?? 0);
      if (aPct !== bPct) return bPct - aPct;

      if (a.hot !== b.hot) return a.hot ? -1 : 1;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } else if (sort === "hot") {
    sorted = [...enriched].sort((a, b) => {
      if (a.hot !== b.hot) return a.hot ? -1 : 1;

      const aPct = computeDiscountPct(a.discountType, a.discountValue ?? 0);
      const bPct = computeDiscountPct(b.discountType, b.discountValue ?? 0);
      if (aPct !== bPct) return bPct - aPct;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } else {
    sorted = [...enriched].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  return (
    <ExploreClient
      deals={sorted as any}
      bannerStats={{
        activeDeals,
        highestDiscountPct,
      }}
    />
  );
}
