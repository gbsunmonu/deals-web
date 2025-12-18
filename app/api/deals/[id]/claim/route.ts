import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

const QR_TTL_MINUTES = 15;
const COOLDOWN_SECONDS = 20; // per-device cooldown between NEW QR generations
const DAILY_DEVICE_CAP = 10; // ✅ max NEW QRs per device per 24h (tune this)

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function generateUniqueShortCode(tx: Prisma.TransactionClient) {
  for (let i = 0; i < 6; i++) {
    const shortCode = makeShortCode(6);
    const exists = await tx.redemption.findUnique({
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

async function lockDealAndCheckSoldOut(
  tx: Prisma.TransactionClient,
  dealId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const now = new Date();

  const rows = await tx.$queryRaw<
    Array<{ id: string; maxRedemptions: number | null; startsAt: Date; endsAt: Date }>
  >`
    SELECT "id", "maxRedemptions", "startsAt", "endsAt"
    FROM "Deal"
    WHERE "id" = CAST(${dealId} AS uuid)
    FOR UPDATE
  `;

  if (!rows || rows.length === 0) return { ok: false, status: 404, error: "Deal not found" };

  const deal = rows[0];

  if (deal.startsAt > now) return { ok: false, status: 409, error: "Deal has not started yet" };
  if (deal.endsAt < now) return { ok: false, status: 409, error: "Deal has ended" };

  const max = deal.maxRedemptions;
  if (typeof max !== "number" || max <= 0) return { ok: true };

  const redeemedCount = await tx.redemption.count({
    where: { dealId, redeemedAt: { not: null } },
  });

  if (redeemedCount >= max) return { ok: false, status: 409, error: "Sold out" };

  return { ok: true };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: dealId } = await ctx.params;

    const deviceId = req.headers.get("x-device-id") || req.headers.get("x-device") || "";

    if (!dealId) return NextResponse.json({ ok: false, error: "Missing deal id" }, { status: 400 });
    if (!deviceId || deviceId.length < 8) {
      return NextResponse.json({ ok: false, error: "Missing device id" }, { status: 400 });
    }

    const deviceHash = sha256(deviceId);
    const activeKey = `${dealId}:${deviceHash}`;

    const result = await withTxnRetry(async () => {
      return prisma.$transaction(async (tx) => {
        const gate = await lockDealAndCheckSoldOut(tx, dealId);
        if (!gate.ok) return { kind: "ERR" as const, status: gate.status, error: gate.error };

        const now = new Date();

        // ✅ 1) Reuse active QR if it exists & still valid (NO daily cap hit)
        const existing = await tx.redemption.findFirst({
          where: { activeKey },
          select: { id: true, shortCode: true, redeemedAt: true, expiresAt: true },
        });

        if (existing) {
          const exp = existing.expiresAt ? new Date(existing.expiresAt) : null;

          if (existing.redeemedAt) {
            await tx.redemption.update({ where: { id: existing.id }, data: { activeKey: null } });
          } else if (exp && exp > now) {
            return {
              kind: "OK" as const,
              redemptionId: existing.id,
              shortCode: existing.shortCode,
              expiresAt: exp.toISOString(),
              reused: true,
            };
          } else {
            await tx.redemption.update({ where: { id: existing.id }, data: { activeKey: null } });
          }
        }

        // ✅ 2) Per-device cooldown (only for NEW QR)
        const latest = await tx.redemption.findFirst({
          where: { dealId, deviceHash },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        });

        if (latest) {
          const ageMs = now.getTime() - new Date(latest.createdAt).getTime();
          const cooldownMs = COOLDOWN_SECONDS * 1000;

          if (ageMs < cooldownMs) {
            const retryAfterSec = Math.ceil((cooldownMs - ageMs) / 1000);
            return {
              kind: "ERR" as const,
              status: 429,
              error: `Please wait ${retryAfterSec}s before generating a new QR.`,
              retryAfterSec,
              cooldownSeconds: retryAfterSec,
            };
          }
        }

        // ✅ 3) Daily per-device cap (rolling 24 hours) — only for NEW QR
        const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const usedInWindow = await tx.redemption.count({
          where: {
            deviceHash,
            dealId,
            createdAt: { gte: windowStart },
          },
        });

        if (usedInWindow >= DAILY_DEVICE_CAP) {
          // Find earliest in window to compute retry time (nice UX)
          const first = await tx.redemption.findFirst({
            where: { deviceHash, dealId, createdAt: { gte: windowStart } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          });

          const resetAt = first ? new Date(new Date(first.createdAt).getTime() + 24 * 60 * 60 * 1000) : null;
          const retryAfterSec =
            resetAt && resetAt.getTime() > now.getTime()
              ? Math.ceil((resetAt.getTime() - now.getTime()) / 1000)
              : 60;

          return {
            kind: "ERR" as const,
            status: 429,
            error: `Daily limit reached for this device. Try again later.`,
            retryAfterSec,
            dailyLimitSeconds: retryAfterSec,
          };
        }

        // ✅ 4) Create new QR
        const shortCode = await generateUniqueShortCode(tx);
        const expiresAt = new Date(Date.now() + QR_TTL_MINUTES * 60 * 1000);

        const created = await tx.redemption.create({
          data: {
            dealId,
            shortCode,
            code: shortCode,
            redeemedAt: null,
            expiresAt,
            deviceHash,
            activeKey,
          },
          select: { id: true, shortCode: true },
        });

        return {
          kind: "OK" as const,
          redemptionId: created.id,
          shortCode: created.shortCode,
          expiresAt: expiresAt.toISOString(),
          reused: false,
        };
      });
    });

    if (result.kind === "ERR") {
      const headers: Record<string, string> = {};
      if ((result as any).retryAfterSec) headers["Retry-After"] = String((result as any).retryAfterSec);

      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          cooldownSeconds: (result as any).cooldownSeconds,
          dailyLimitSeconds: (result as any).dailyLimitSeconds,
          retryAfterSeconds: (result as any).retryAfterSec,
        },
        { status: result.status, headers }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        redemptionId: result.redemptionId,
        shortCode: result.shortCode,
        expiresAt: result.expiresAt,
        reused: result.reused,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("POST /api/deals/[id]/claim error:", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected error creating QR", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
