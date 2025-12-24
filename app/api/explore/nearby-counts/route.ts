// app/api/explore/nearby-counts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseNum(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Haversine distance (km) */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const lat = parseNum(url.searchParams.get("lat"));
    const lng = parseNum(url.searchParams.get("lng"));

    if (
      lat == null ||
      lng == null ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return NextResponse.json({ error: "invalid_coords" }, { status: 400 });
    }

    const now = new Date();

    // Active deals only (matches your banner “Active deals” logic)
    // We only need merchant coords to compute distance.
    const deals = await prisma.deal.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gte: now },
        merchant: {
          is: {
            lat: { not: null },
            lng: { not: null },
          },
        },
      },
      take: 500, // safety
      select: {
        id: true,
        merchant: {
          select: { lat: true, lng: true },
        },
      },
    });

    let c2 = 0;
    let c5 = 0;
    let c10 = 0;

    for (const d of deals) {
      const mLat = d.merchant?.lat;
      const mLng = d.merchant?.lng;
      if (typeof mLat !== "number" || typeof mLng !== "number") continue;

      const dist = distanceKm(lat, lng, mLat, mLng);
      if (dist <= 2) c2++;
      if (dist <= 5) c5++;
      if (dist <= 10) c10++;
    }

    return NextResponse.json(
      {
        ok: true,
        counts: { 2: c2, 5: c5, 10: c10 },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    console.error("nearby-counts error:", e);
    return NextResponse.json(
      { error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
