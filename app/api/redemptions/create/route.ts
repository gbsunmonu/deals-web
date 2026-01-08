// app/api/redemptions/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

const QR_TTL_MINUTES = 15;
const DEVICE_COOLDOWN_SECONDS = 30; // ⬅️ change if you want (e.g. 60)

// ✅ Crypto-safe short code (no Math.random)
function makeShortCode(len = 6) {
  // base64url is URL-safe; we also strip - and _ to keep it cleaner
  const raw = crypto.randomBytes(Math.ceil(len * 0.75)).toString("base64url");
  return raw.replace(/[-_]/g, "").toUpperCase().slice(0, len);
}

async function generateUniqueRedemptionShortCode() {
  for (let i = 0; i < 10; i++) {
    const shortCode = makeShortCode(6);
    const exists = await prisma.redemption.findUnique({
      where: { shortCode },
      select: { id: true },
    });
    if (!exists) return shortCode;
  }
  // very unlikely fallback
  return makeShortCode(8);
}

async function generateUniqueRedemptionCode() {
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(16).toString("base64url");
    const exists = await prisma.redemption.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  // extremely unlikely fallback
  return crypto.randomBytes(24).toString("base64url");
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function getDealAvailability(tx: Prisma.TransactionClient, dealId: string) {
  const deal = await tx.deal.findUnique({
    where: { id: dealId },
    select: { maxRedemptions: true },
  });

  const max = deal?.maxRedemptions ?? null;

  if (!max) {
    const redeemedCount = await tx.redemption.count({
      where: { dealId, redeemedAt: { not: null } },
    });
    return { max, redeemedCount, soldOut: false };
  }

  const redeemedCount = await tx.redemption.count({
    where: { dealId, redeemedAt: { not: null } },
  });

  return { max, redeemedCount, soldOut: redeemedCount >= max };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const dealId = String(body?.dealId || "");

    if (!dealId) {
      return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
    }

    const ua = req.headers.get("user-agent") || "";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";

    const deviceIdHeader = req.headers.get("x-device-id") || "";
    const deviceKeyRaw = deviceIdHeader
      ? `device:${deviceIdHeader}`
      : `ipua:${ip}|${ua}`;

    const deviceHash = sha256(deviceKeyRaw);

    const now = new Date();

    const redemption = await prisma.$transaction(async (tx) => {
      // Cooldown: prevent spam creation
      const recent = await tx.redemption.findFirst({
        where: {
          deviceHash,
          createdAt: {
            gte: new Date(now.getTime() - DEVICE_COOLDOWN_SECONDS * 1000),
          },
        },
        select: { id: true },
      });

      if (recent) {
        throw new Error("Cooldown: please wait a moment before trying again.");
      }

      // Deal exists + availability
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        select: { id: true, endsAt: true },
      });

      if (!deal) throw new Error("Deal not found.");

      if (deal.endsAt.getTime() < now.getTime()) {
        throw new Error("Deal has expired.");
      }

      const availability = await getDealAvailability(tx, dealId);
      if (availability.soldOut) {
        throw new Error("Sold out.");
      }

      const shortCode = await generateUniqueRedemptionShortCode();
      const code = await generateUniqueRedemptionCode();

      const expiresAt = new Date(now.getTime() + QR_TTL_MINUTES * 60 * 1000);

      return await tx.redemption.create({
        data: {
          dealId,
          code,
          shortCode,
          expiresAt,
          deviceHash,
        },
        select: {
          id: true,
          code: true,
          shortCode: true,
          expiresAt: true,
        },
      });
    });

    return NextResponse.json(
      {
        redemptionId: redemption.id,
        code: redemption.code,
        shortCode: redemption.shortCode,
        expiresAt: redemption.expiresAt,
      },
      { status: 200 }
    );
  } catch (err: any) {
    const msg = String(err?.message || "Unexpected error");
    const status =
      msg.includes("Cooldown") || msg.includes("Sold out") || msg.includes("expired")
        ? 429
        : msg.includes("not found") || msg.includes("Missing")
        ? 400
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
