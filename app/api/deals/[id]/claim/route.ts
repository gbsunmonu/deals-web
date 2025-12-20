import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

const QR_TTL_MINUTES = 15;
const COOLDOWN_SECONDS = 20;
const MAX_ACTIVE_QRS_PER_DEVICE = 1;

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

function isStillValid(expiresAt: Date | null | undefined, now: Date) {
  if (!expiresAt) return false;
  return expiresAt.getTime() > now.getTime();
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: dealId } = await ctx.params;

    const deviceId = req.headers.get("x-device-id") || req.headers.get("x-device") || "";
    const userAgent = req.headers.get("user-agent") || null;

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

        // cleanup expired actives for this device
        await tx.redemption.updateMany({
          where: {
            deviceHash,
            activeKey: { not: null },
            redeemedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { lte: now } }],
          },
          data: { activeKey: null },
        });

        // reuse existing active QR if still valid
        const existing = await tx.redemption.findFirst({
          where: { activeKey },
          select: { id: true, shortCode: true, redeemedAt: true, expiresAt: true },
        });

        if (existing) {
          if (existing.redeemedAt) {
            await tx.redemption.update({ where: { id: existing.id }, data: { activeKey: null } });
          } else if (isStillValid(existing.expiresAt, now)) {
            return {
              kind: "OK" as const,
              redemptionId: existing.id,
              shortCode: existing.shortCode,
              expiresAt: existing.expiresAt!.toISOString(),
              reused: true,
            };
          } else {
            await tx.redemption.update({ where: { id: existing.id }, data: { activeKey: null } });
          }
        }

        // anti-hoarding: other active QRs on device
        if (MAX_ACTIVE_QRS_PER_DEVICE > 0) {
          const otherActives = await tx.redemption.findMany({
            where: {
              deviceHash,
              activeKey: { not: null },
              redeemedAt: null,
              expiresAt: { gt: now },
              dealId: { not: dealId },
            },
            orderBy: { expiresAt: "asc" },
            take: MAX_ACTIVE_QRS_PER_DEVICE,
            select: { dealId: true, expiresAt: true, shortCode: true },
          });

          if (otherActives.length >= MAX_ACTIVE_QRS_PER_DEVICE) {
            const soonest = otherActives[0];
            const retryAfterSec = soonest.expiresAt
              ? Math.max(1, Math.ceil((soonest.expiresAt.getTime() - now.getTime()) / 1000))
              : QR_TTL_MINUTES * 60;

            // ✅ Prisma uses camelCase fields
            await tx.redemptionBlockLog.create({
              data: {
                deviceHash,
                requestedDealId: dealId,
                blockedDealId: soonest.dealId,
                blockedShortCode: soonest.shortCode ?? null,
                blockedExpiresAt: soonest.expiresAt ?? null,
                reason: "ACTIVE_QR_EXISTS",
                retryAfterSec,
                userAgent,
              },
            });

            return {
              kind: "ERR" as const,
              status: 429,
              error:
                "You already have an active QR on this device. Use it or wait for it to expire before generating a new one.",
              retryAfterSec,
              blockedBy: {
                dealId: soonest.dealId,
                shortCode: soonest.shortCode,
                expiresAt: soonest.expiresAt?.toISOString() ?? null,
              },
            };
          }
        }

        // cooldown for this deal+device
        const latest = await tx.redemption.findFirst({
          where: { dealId, deviceHash },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });

        if (latest) {
          const ageMs = now.getTime() - new Date(latest.createdAt).getTime();
          const cooldownMs = COOLDOWN_SECONDS * 1000;

          if (ageMs < cooldownMs) {
            const retryAfterSec = Math.ceil((cooldownMs - ageMs) / 1000);

            await tx.redemptionBlockLog.create({
              data: {
                deviceHash,
                requestedDealId: dealId,
                reason: "COOLDOWN",
                retryAfterSec,
                userAgent,
              },
            });

            return {
              kind: "ERR" as const,
              status: 429,
              error: `Please wait ${retryAfterSec}s before generating a new QR.`,
              retryAfterSec,
            };
          }
        }

        // create NEW QR
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
      const retry = (result as any).retryAfterSec;
      if (retry) headers["Retry-After"] = String(retry);

      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          retryAfterSeconds: retry ?? undefined,
          blockedBy: (result as any).blockedBy ?? undefined,
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
