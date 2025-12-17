// app/api/redemptions/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

const QR_TTL_MINUTES = 15;
const DEVICE_COOLDOWN_SECONDS = 30; // ⬅️ change if you want (e.g. 60)

function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function generateUniqueRedemptionShortCode() {
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

async function withTxnRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const code = e?.code;
      const msg = String(e?.message ?? "").toLowerCase();
      const shouldRetry =
        code === "P2034" ||
        msg.includes("serialization") ||
        msg.includes("deadlock") ||
        msg.includes("could not serialize access");

      if (!shouldRetry || i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 30 * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Locks the deal row + enforces capacity safely (UUID cast).
 */
async function lockDealAndEnforceCapacity(
  tx: Prisma.TransactionClient,
  dealId: string
): Promise<{ max: number | null; redeemedCount: number; soldOut: boolean }> {
  const rows = await tx.$queryRaw<Array<{ id: string; maxRedemptions: number | null }>>`
    SELECT "id", "maxRedemptions"
    FROM "Deal"
    WHERE "id" = CAST(${dealId} AS uuid)
    FOR UPDATE
  `;

  if (!rows || rows.length === 0) {
    const err: any = new Error("Deal not found");
    err.status = 404;
    err.code = "DEAL_NOT_FOUND";
    throw err;
  }

  const max = rows[0].maxRedemptions;

  // unlimited if null/undefined/<=0
  if (typeof max !== "number" || max <= 0) {
    return { max: max ?? null, redeemedCount: 0, soldOut: false };
  }

  const redeemedCount = await tx.redemption.count({
    where: { dealId, redeemedAt: { not: null } },
  });

  return { max, redeemedCount, soldOut: redeemedCount >= max };
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const dealId = body?.dealId ? String(body.dealId) : "";
    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    // Client sends a stable per-device id (localStorage). If missing, fallback to IP+UA.
    const deviceIdHeader = req.headers.get("x-device-id") || "";
    const ua = req.headers.get("user-agent") || "";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const deviceFingerprint = deviceIdHeader.trim() || `${ip}|${ua}`;
    const deviceHash = sha256(deviceFingerprint);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + QR_TTL_MINUTES * 60 * 1000);
    const activeKey = `${dealId}:${deviceHash}`;
    const cooldownSince = new Date(now.getTime() - DEVICE_COOLDOWN_SECONDS * 1000);

    return await withTxnRetry(async () => {
      const out = await prisma.$transaction(async (tx) => {
        // 1) Release expired active locks for this device+deal (so device can claim again)
        await tx.redemption.updateMany({
          where: {
            activeKey,
            redeemedAt: null,
            expiresAt: { lte: now },
          },
          data: { activeKey: null },
        });

        // 2) If there is an ACTIVE (not expired) redemption for this device+deal, return it
        const active = await tx.redemption.findFirst({
          where: {
            activeKey,
            redeemedAt: null,
            expiresAt: { gt: now },
          },
          select: { id: true, shortCode: true, code: true, expiresAt: true, createdAt: true, dealId: true },
        });

        if (active) {
          return { kind: "ACTIVE_EXISTS" as const, redemption: active, retryAfterSeconds: 0 };
        }

        // 3) Cooldown: block repeated claims even if previous expired recently
        const recent = await tx.redemption.findFirst({
          where: {
            dealId,
            deviceHash,
            createdAt: { gt: cooldownSince },
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });

        if (recent) {
          const elapsedSec = Math.floor((now.getTime() - recent.createdAt.getTime()) / 1000);
          const retryAfterSeconds = Math.max(1, DEVICE_COOLDOWN_SECONDS - elapsedSec);
          return { kind: "COOLDOWN" as const, retryAfterSeconds };
        }

        // 4) Capacity enforcement (locks deal row)
        const { soldOut } = await lockDealAndEnforceCapacity(tx, dealId);
        if (soldOut) return { kind: "SOLD_OUT" as const };

        // 5) Create new redemption (ACTIVE lock)
        const shortCode = await generateUniqueRedemptionShortCode();

        const redemption = await tx.redemption.create({
          data: {
            dealId,
            shortCode,
            code: shortCode, // simple: QR payload = shortCode
            expiresAt,
            deviceHash,
            activeKey,
          },
          select: { id: true, shortCode: true, code: true, expiresAt: true, createdAt: true, dealId: true },
        });

        return { kind: "CREATED" as const, redemption, retryAfterSeconds: 0 };
      });

      if (out.kind === "SOLD_OUT") {
        return NextResponse.json(
          { ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." },
          { status: 409 }
        );
      }

      if (out.kind === "COOLDOWN") {
        return NextResponse.json(
          {
            ok: false,
            status: "COOLDOWN",
            error: "Please wait before claiming again.",
            retryAfterSeconds: out.retryAfterSeconds,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          status: out.kind === "ACTIVE_EXISTS" ? "ACTIVE_EXISTS" : "CREATED",
          redemption: out.redemption,
        },
        { status: 200 }
      );
    });
  } catch (err: any) {
    console.error("Unexpected error in /api/redemptions/create:", err);
    return NextResponse.json(
      { error: "Unexpected error creating redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
