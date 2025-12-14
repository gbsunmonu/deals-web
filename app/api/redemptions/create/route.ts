// app/api/redemptions/create/route.ts
// Creates a NEW customer redemption code (short code) for a deal,
// but enforces: 1 active QR per (device + deal) at a time.
// QR expires after 15 minutes.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrSetAnonDeviceId, hashDeviceId } from "@/lib/anonDevice";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export async function POST(req: NextRequest) {
  const res = NextResponse.next(); // we’ll convert this to JSON later but keep cookies settable

  try {
    const body = await req.json().catch(() => ({}));
    const dealId = body?.dealId as string | undefined;

    if (!dealId || typeof dealId !== "string") {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    // Ensure deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // ✅ device lock (no customer account required)
    const deviceId = getOrSetAnonDeviceId(req, res);
    const deviceHash = hashDeviceId(deviceId);
    const activeKey = `${dealId}:${deviceHash}`;

    const now = new Date();

    // ✅ If this device already has an active unredeemed, unexpired QR for this deal, reuse it
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
      // carry cookie from `res` to `out`
      out.cookies.set(res.cookies.getAll()[0] ?? []);
      res.cookies.getAll().forEach((c) => out.cookies.set(c));
      return out;
    }

    // Create a new QR redemption (NOT redeemed yet) - 15 minute expiry
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

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
            activeKey, // unique per device+deal
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
        res.cookies.getAll().forEach((c) => out.cookies.set(c));
        return out;
      } catch (err: any) {
        // Unique constraint collision -> retry
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
