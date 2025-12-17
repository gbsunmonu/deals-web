// app/api/redemptions/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function generateUniqueShortCode() {
  for (let i = 0; i < 6; i++) {
    const shortCode = makeShortCode(6);
    const exists = await prisma.redemption.findUnique({ where: { shortCode }, select: { id: true } });
    if (!exists) return shortCode;
  }
  return makeShortCode(8);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dealId = String(body?.dealId ?? "").trim();
    const deviceId = String(body?.deviceId ?? "").trim();

    if (!dealId) return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    if (!deviceId) return NextResponse.json({ error: "deviceId is required" }, { status: 400 });

    const now = new Date();

    // ensure deal exists + is active
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, maxRedemptions: true, startsAt: true, endsAt: true },
    });

    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    if (deal.startsAt > now) return NextResponse.json({ error: "Deal has not started" }, { status: 409 });
    if (deal.endsAt < now) return NextResponse.json({ error: "Deal has ended" }, { status: 409 });

    // capacity check (simple, safe)
    if (typeof deal.maxRedemptions === "number" && deal.maxRedemptions > 0) {
      const redeemedCount = await prisma.redemption.count({
        where: { dealId, redeemedAt: { not: null } },
      });
      if (redeemedCount >= deal.maxRedemptions) {
        return NextResponse.json({ ok: false, status: "SOLD_OUT", error: "Sold out" }, { status: 409 });
      }
    }

    const deviceHash = sha256(deviceId);
    const activeKey = `${dealId}:${deviceHash}`;

    // if an active (unexpired + unredeemed) QR already exists for this device+deal, return it
    const existing = await prisma.redemption.findFirst({
      where: {
        activeKey,
        redeemedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true, shortCode: true, code: true, expiresAt: true, createdAt: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          status: "EXISTING",
          redemption: existing,
        },
        { status: 200 }
      );
    }

    // create a fresh QR (15 mins)
    const shortCode = await generateUniqueShortCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // We store code same as shortCode (simple)
    const redemption = await prisma.redemption.create({
      data: {
        dealId,
        code: shortCode,
        shortCode,
        redeemedAt: null,
        createdAt: now,
        expiresAt,
        deviceHash,
        activeKey,
      } as any,
      select: { id: true, shortCode: true, code: true, expiresAt: true, createdAt: true },
    });

    return NextResponse.json(
      {
        ok: true,
        status: "CREATED",
        redemption,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[/api/redemptions/create] error:", err);
    return NextResponse.json(
      { error: "Failed to create redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
