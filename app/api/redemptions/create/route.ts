// app/api/redemptions/create/route.ts
// Creates a NEW customer redemption code (short code) for a deal,
// but enforces: 1 active QR per (device + deal) at a time.
// QR expires after 15 minutes.
// ✅ NEW: blocks generation if deal is sold out (maxRedemptions reached).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrSetAnonDeviceId, hashDeviceId } from "@/lib/anonDevice";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QR_TTL_MINUTES = 15;

function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function generateUniqueShortCode() {
  for (let i = 0; i < 6; i++) {
    const shortCode = makeShortCode(6);
    const exists = await prisma.redemption.findUnique({
      where: { shortCode },
      select: { id: true },
    });
    if (!exists) return shortCode;
  }
  return makeShortCode(8);
}

async function getAvailability(dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, maxRedemptions: true },
  });

  if (!deal) return { exists: false as const };

  const redeemedCount = await prisma.redemption.count({
    where: { dealId, redeemedAt: { not: null } },
  });

  const max = deal.maxRedemptions;
  const limited = typeof max === "number" && max > 0;

  const left = limited ? Math.max(max - redeemedCount, 0) : null;
  const soldOut = limited ? redeemedCount >= max : false;

  return { exists: true as const, max, redeemedCount, left, soldOut };
}

export async function POST(req: NextRequest) {
  // we need a response object to set cookies
  const cookieRes = NextResponse.next();

  try {
    const body = await req.json().catch(() => ({}));
    const dealId = body?.dealId as string | undefined;

    if (!dealId || typeof dealId !== "string") {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    // ✅ Sold out check (prevents QR generation spam)
    const avail = await getAvailability(dealId);
    if (!avail.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    if (avail.soldOut) {
      return NextResponse.json(
        {
          ok: false,
          status: "SOLD_OUT",
          error: "This deal is sold out.",
          left: 0,
          maxRedemptions: avail.max ?? null,
          redeemedCount: avail.redeemedCount,
        },
        { status: 409 }
      );
    }

    // ✅ device lock (no customer account required)
    const deviceId = getOrSetAnonDeviceId(req, cookieRes);
    const deviceHash = hashDeviceId(deviceId);
    const activeKey = `${dealId}:${deviceHash}`;

    const now = new Date();

    // Reuse an active unredeemed, unexpired QR for this deal+device
    const existing = await prisma.redemption.findFirst({
      where: {
        activeKey,
        redeemedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        code: true,
        shortCode: true,
        redeemedAt: true,
        expiresAt: true,
      },
    });

    if (existing) {
      const out = NextResponse.json(existing, { status: 200 });
      cookieRes.cookies.getAll().forEach((c) => out.cookies.set(c));
      return out;
    }

    // Create a new QR redemption (NOT redeemed yet) - 15 minute expiry
    const expiresAt = new Date(Date.now() + QR_TTL_MINUTES * 60 * 1000);

    for (let i = 0; i < 6; i++) {
      const shortCode = await generateUniqueShortCode();

      try {
        const created = await prisma.redemption.create({
          data: {
            dealId,
            code: shortCode,
            shortCode,
            redeemedAt: null,
            expiresAt,
            deviceHash,
            activeKey,
          },
          select: {
            id: true,
            code: true,
            shortCode: true,
            redeemedAt: true,
            expiresAt: true,
          },
        });

        const out = NextResponse.json(created, { status: 201 });
        cookieRes.cookies.getAll().forEach((c) => out.cookies.set(c));
        return out;
      } catch (err: any) {
        if (err?.code === "P2002") continue;
        throw err;
      }
    }

    return NextResponse.json(
      { error: "Failed to generate a unique redemption code" },
      { status: 500 }
    );
  } catch (err: any) {
    console.error("[redemptions/create] error:", err);
    return NextResponse.json(
      { error: "Failed to create redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
