// app/api/redeem/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    ""
  );
}

async function logBlock(args: {
  reason: string;
  type?: string;
  deviceHash?: string | null;
  requestedDealId?: string | null;
  redemptionId?: string | null;
  visitorId?: string | null;
  userAgent?: string | null;
  path?: string | null;
  dayKey?: string | null;
  ipHash?: string | null;
}) {
  try {
    if (!args.deviceHash && !args.visitorId) return;

    await prisma.trackDropLog.create({
      data: {
        reason: args.reason,
        type: args.type ?? "REDEEM_CONFIRM",
        deviceHash: args.deviceHash ?? undefined,
        visitorId: args.visitorId ?? undefined,
        userAgent: args.userAgent ?? undefined,
        path: args.path ?? undefined,
        dealId: args.requestedDealId ?? undefined,
        dayKey: args.dayKey ?? undefined,
        ipHash: args.ipHash ?? undefined,
        merchantId: undefined,
      },
    });
  } catch {
    // never fail request because of logging
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const redemptionId = body?.redemptionId ? String(body.redemptionId) : "";
    const code = body?.code ? String(body.code).trim() : "";
    const dealId = body?.dealId ? String(body.dealId) : null;

    const deviceId =
      req.headers.get("x-device-id") || req.headers.get("x-device") || "";
    const deviceHash = deviceId ? sha256(deviceId) : null;

    const userAgent = req.headers.get("user-agent");
    const ip = getClientIp(req);
    const ipHash = ip ? sha256(ip) : null;
    const path = body?.path ? String(body.path) : null;

    if (!redemptionId && !code) {
      await logBlock({
        reason: "MISSING_REDEMPTION_ID_OR_CODE",
        deviceHash,
        requestedDealId: dealId,
        userAgent,
        ipHash,
        path,
      });

      return NextResponse.json(
        { ok: false, error: "missing_redemption_identifier" },
        { status: 400 }
      );
    }

    // Find redemption by id or code
    const redemption = await prisma.redemption.findFirst({
      where: redemptionId ? { id: redemptionId } : { code },
      select: {
        id: true,
        dealId: true,
        redeemedAt: true,
        expiresAt: true,
        deviceHash: true,
        activeKey: true,
      },
    });

    if (!redemption) {
      await logBlock({
        reason: "REDEMPTION_NOT_FOUND",
        deviceHash,
        requestedDealId: dealId,
        redemptionId: redemptionId || null,
        userAgent,
        ipHash,
        path,
      });

      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404 }
      );
    }

    // Check expiry
    const now = new Date();
    if (redemption.expiresAt && redemption.expiresAt <= now) {
      await logBlock({
        reason: "REDEMPTION_EXPIRED",
        deviceHash,
        requestedDealId: redemption.dealId,
        redemptionId: redemption.id,
        userAgent,
        ipHash,
        path,
      });

      return NextResponse.json(
        { ok: false, error: "expired" },
        { status: 410 }
      );
    }

    // Already redeemed
    if (redemption.redeemedAt) {
      return NextResponse.json(
        { ok: true, status: "already_redeemed", redeemedAt: redemption.redeemedAt },
        { status: 200 }
      );
    }

    // Optional: enforce same device if present
    if (redemption.deviceHash && deviceHash && redemption.deviceHash !== deviceHash) {
      await logBlock({
        reason: "DEVICE_MISMATCH",
        deviceHash,
        requestedDealId: redemption.dealId,
        redemptionId: redemption.id,
        userAgent,
        ipHash,
        path,
      });

      return NextResponse.json(
        { ok: false, error: "device_mismatch" },
        { status: 403 }
      );
    }

    // Confirm redeem
    const updated = await prisma.redemption.update({
      where: { id: redemption.id },
      data: {
        redeemedAt: now,
        activeKey: null,
      },
      select: {
        id: true,
        dealId: true,
        redeemedAt: true,
      },
    });

    // Track event (best-effort)
    try {
      await prisma.event.create({
        data: {
          type: "DEAL_REDEEM_SUCCESS" as any,
          deviceHash: deviceHash ?? "unknown",
          dayKey: `DEAL_REDEEM_SUCCESS:${deviceHash ?? "unknown"}:${updated.dealId}:${now.toISOString().slice(0, 10)}`.slice(
            0,
            128
          ),
          dealId: updated.dealId,
          merchantId: null,
          visitorId: null,
          meta: { source: "redeem_confirm" },
          city: null,
          userAgent: userAgent ?? null,
          ipHash: ipHash ?? null,
        },
      });
    } catch {
      // ignore dedupe collisions or logging failure
    }

    return NextResponse.json({ ok: true, redemption: updated }, { status: 200 });
  } catch (e: any) {
    console.error("/api/redeem/confirm error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
