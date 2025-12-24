// app/api/deals/nearby/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

function boolParam(v: string | null) {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDealLive(now: Date, startsAt: Date, endsAt: Date) {
  return now >= startsAt && now <= endsAt;
}

function computeHotDeal(args: {
  discountType: string;
  discountValue: number;
  originalPrice: number | null;
}) {
  const pct = clamp(Math.round(args.discountValue || 0), 0, 100);
  const isPercent =
    args.discountType === "PERCENT" || args.discountType === "PERCENTAGE";

  const saveAmount =
    args.originalPrice && args.originalPrice > 0 && isPercent && pct > 0
      ? Math.round((args.originalPrice * pct) / 100)
      : null;

  // same as DealCard rule:
  return (saveAmount != null && saveAmount >= 1000) || pct >= 45;
}

/**
 * Base ranking:
 * - Distance: 0..60
 * - Discount: 0..25
 * - Urgency: 0..20
 * - Hot boost: +10
 */
function rankDeal(args: {
  now: Date;
  startsAt: Date;
  endsAt: Date;
  distanceKm: number;
  discountType: string;
  discountValue: number;
  originalPrice: number | null;
  soldOut?: boolean;
  hotFirst?: boolean;
}) {
  const {
    now,
    startsAt,
    endsAt,
    distanceKm,
    discountType,
    discountValue,
    originalPrice,
    soldOut,
    hotFirst,
  } = args;

  if (!isDealLive(now, startsAt, endsAt)) return -999999;
  if (soldOut) return -999999;

  const d = Math.max(0, distanceKm);
  const distancePoints = clamp(60 * Math.exp(-d / 8), 0, 60);

  const pct = clamp(Math.round(discountValue || 0), 0, 100);
  const isPercent = discountType === "PERCENT" || discountType === "PERCENTAGE";
  const discountPoints = isPercent ? clamp((pct / 100) * 25, 0, 25) : 0;

  const msLeft = endsAt.getTime() - now.getTime();
  let urgencyPoints = 0;

  if (msLeft > 0) {
    const hoursLeft = msLeft / (60 * 60 * 1000);
    if (hoursLeft <= 1) urgencyPoints = 20;
    else if (hoursLeft <= 6) urgencyPoints = 14;
    else if (isSameLocalDay(endsAt, now)) urgencyPoints = 8;
    else urgencyPoints = clamp(6 * Math.exp(-hoursLeft / 36), 0, 6);
  }

  const isHotDeal = computeHotDeal({ discountType, discountValue: pct, originalPrice });
  const hotBoostBase = isHotDeal ? 10 : 0;

  // ✅ If hotFirst enabled, add EXTRA boost (still not infinite)
  const hotFirstBoost = hotFirst && isHotDeal ? 12 : 0; // tune later

  // tiny tie breaker
  const tieBreaker = pct * 0.01;

  return distancePoints + discountPoints + urgencyPoints + hotBoostBase + hotFirstBoost + tieBreaker;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const lat = n(url.searchParams.get("lat"), NaN);
    const lng = n(url.searchParams.get("lng"), NaN);

    const radiusKm = clamp(n(url.searchParams.get("radiusKm"), 25), 1, 100);
    const limit = clamp(n(url.searchParams.get("limit"), 30), 1, 60);

    const hotOnly = boolParam(url.searchParams.get("hotOnly"));
    const hotFirst = boolParam(url.searchParams.get("hotFirst"));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "missing_lat_lng" }, { status: 400 });
    }

    const now = new Date();

    const candidates = await prisma.deal.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gte: now },
        merchant: {
          lat: { not: null },
          lng: { not: null },
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        originalPrice: true,
        discountType: true,
        discountValue: true,
        startsAt: true,
        endsAt: true,
        imageUrl: true,
        maxRedemptions: true,
        merchant: { select: { id: true, name: true, city: true, lat: true, lng: true } },
      },
      take: 400,
    });

    const ids = candidates.map((d) => d.id);
    const redeemedCounts = await prisma.redemption.groupBy({
      by: ["dealId"],
      where: { dealId: { in: ids }, redeemedAt: { not: null } },
      _count: { dealId: true },
    });
    const redeemedMap = new Map(redeemedCounts.map((r) => [r.dealId, r._count.dealId]));

    const ranked = candidates
      .map((d) => {
        const mlat = d.merchant.lat ?? null;
        const mlng = d.merchant.lng ?? null;
        if (mlat == null || mlng == null) return null;

        const distanceKm = haversineKm(lat, lng, mlat, mlng);
        if (distanceKm > radiusKm) return null;

        const redeemedCount = redeemedMap.get(d.id) ?? 0;
        const max = d.maxRedemptions ?? null;
        const soldOut = typeof max === "number" && max > 0 ? redeemedCount >= max : false;
        const left = typeof max === "number" && max > 0 ? Math.max(0, max - redeemedCount) : null;

        const discountType = String(d.discountType);
        const discountValue = n(d.discountValue, 0);
        const originalPrice = d.originalPrice ?? null;

        const isHotDeal = computeHotDeal({ discountType, discountValue, originalPrice });

        // ✅ Hot-only filter
        if (hotOnly && !isHotDeal) return null;

        const score = rankDeal({
          now,
          startsAt: new Date(d.startsAt),
          endsAt: new Date(d.endsAt),
          distanceKm,
          discountType,
          discountValue,
          originalPrice,
          soldOut,
          hotFirst,
        });

        return {
          ...d,
          distanceKm: Math.round(distanceKm * 10) / 10,
          isHotDeal,
          _score: score,
          availability: {
            soldOut,
            left,
            redeemedCount,
            maxRedemptions: max,
          },
        };
      })
      .filter(Boolean) as any[];

    ranked.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

    const deals = ranked.slice(0, limit).map((x) => {
      const { _score, ...rest } = x;
      return rest;
    });

    return NextResponse.json({
      ok: true,
      radiusKm,
      hotOnly,
      hotFirst,
      count: deals.length,
      deals,
    });
  } catch (e: any) {
    console.error("nearby error:", e);
    return NextResponse.json(
      { error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
