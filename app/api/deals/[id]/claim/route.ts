import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

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

    if (!dealId) return NextResponse.json({ error: "Missing deal id" }, { status: 400 });
    if (!deviceId || deviceId.length < 8) {
      return NextResponse.json({ error: "Missing device id" }, { status: 400 });
    }

    const deviceHash = sha256(deviceId);
    const activeKey = `${dealId}:${deviceHash}`;

    const result = await withTxnRetry(async () => {
      return prisma.$transaction(async (tx) => {
        const gate = await lockDealAndCheckSoldOut(tx, dealId);
        if (!gate.ok) return { kind: "ERR" as const, status: gate.status, error: gate.error };

        const now = new Date();

        const existing = await tx.redemption.findFirst({
          where: { activeKey },
          select: { id: true, shortCode: true, redeemedAt: true, expiresAt: true },
        });

        if (existing) {
          if (existing.redeemedAt) {
            await tx.redemption.update({
              where: { id: existing.id },
              data: { activeKey: null },
            });
          } else if (existing.expiresAt && existing.expiresAt > now) {
            return {
              kind: "OK" as const,
              redemptionId: existing.id,
              shortCode: existing.shortCode,
              expiresAt: existing.expiresAt.toISOString(),
              reused: true,
            };
          } else {
            await tx.redemption.update({
              where: { id: existing.id },
              data: { activeKey: null },
            });
          }
        }

        const shortCode = await generateUniqueShortCode(tx);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const created = await tx.redemption.create({
          data: {
            dealId,
            shortCode,
            code: shortCode,
            redeemedAt: null,
            createdAt: now,
            expiresAt,
            deviceHash,
            activeKey,
          },
          select: { id: true, shortCode: true }, // ✅ don't select expiresAt to avoid nullable typing
        });

        return {
          kind: "OK" as const,
          redemptionId: created.id,
          shortCode: created.shortCode,
          expiresAt: expiresAt.toISOString(), // ✅ use our local non-null expiresAt
          reused: false,
        };
      });
    });

    if (result.kind === "ERR") {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
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
