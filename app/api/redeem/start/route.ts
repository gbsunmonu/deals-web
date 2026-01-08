// app/api/redeem/start/route.ts
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
  visitorId?: string | null;
  userAgent?: string | null;
  ipHash?: string | null;
  path?: string | null;
  dayKey?: string | null;
}) {
  try {
    if (!args.deviceHash && !args.visitorId) return;

    await prisma.trackDropLog.create({
      data: {
        reason: args.reason,
        type: args.type ?? "REDEEM_START",
        deviceHash: args.deviceHash ?? undefined,
        visitorId: args.visitorId ?? undefined,
        userAgent: args.userAgent ?? undefined,
        ipHash: args.ipHash ?? undefined,
        path: args.path ?? undefined,
        dealId: args.requestedDealId ?? undefined,
        dayKey: args.dayKey ?? undefined,
        merchantId: undefined,
      },
    });
  } catch {
    // never fail the request because logging failed
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const dealId = body?.dealId ? String(body.dealId) : "";
    const path = body?.path ? String(body.path) : null;

    const deviceId =
      req.headers.get("x-device-id") || req.headers.get("x-device") || "";
    const deviceHash = deviceId ? sha256(deviceId) : null;

    const userAgent = req.headers.get("user-agent");
    const ip = getClientIp(req);
    const ipHash = ip ? sha256(ip) : null;

    if (!dealId) {
      await logBlock({
        reason: "MISSING_DEAL_ID",
        requestedDealId: null,
        deviceHash,
        userAgent,
        ipHash,
        path,
      });

      return NextResponse.json({ ok: false, error: "missing_dealId" }, { status: 400 });
    }

    // Basic existence check
    const deal = await prisma.deal.findUnique({
      where: { id: dealId as any },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        maxRedemptions: true,
      },
    });

    if (!deal) {
      await logBlock({
        reason: "DEAL_NOT_FOUND",
        requestedDealId: dealId,
        deviceHash,
        userAgent,
        ipHash,
        path,
      });

      return NextResponse.json({ ok: false, error: "deal_not_found" }, { status: 404 });
    }

    const now = new Date();
    if (deal.startsAt > now) {
      await logBlock({
        reason: "DEAL_NOT_STARTED",
        requestedDealId: dealId,
        deviceHash,
        userAgent,
        ipHash,
        path,
      });

      return NextResponse.json({ ok: false, error: "deal_not_started" }, { status: 409 });
    }

    if (deal.endsAt < now) {
      await logBlock({
        reason: "DEAL_ENDED",
        requestedDealId: dealId,
        deviceHash,
        userAgent,
        ipHash,
        path,
      });

      return NextResponse.json({ ok: false, error: "deal_ended" }, { status: 409 });
    }

    // Optional sold-out guard
    if (typeof deal.maxRedemptions === "number" && deal.maxRedemptions > 0) {
      const redeemedCount = await prisma.redemption.count({
        where: { dealId: dealId as any, redeemedAt: { not: null } },
      });

      if (redeemedCount >= deal.maxRedemptions) {
        await logBlock({
          reason: "SOLD_OUT",
          requestedDealId: dealId,
          deviceHash,
          userAgent,
          ipHash,
          path,
        });

        return NextResponse.json({ ok: false, error: "sold_out" }, { status: 409 });
      }
    }

    // Track intent click (best-effort)
    try {
      await prisma.event.create({
        data: {
          type: "DEAL_REDEEM_CLICK" as any,
          deviceHash: deviceHash ?? "unknown",
          dayKey: `DEAL_REDEEM_CLICK:${deviceHash ?? "unknown"}:${dealId}:${now.toISOString().slice(0, 10)}`.slice(
            0,
            128
          ),
          dealId: dealId as any,
          merchantId: null,
          visitorId: null,
          meta: { source: "redeem_start" },
          city: null,
          userAgent: userAgent ?? null,
          ipHash: ipHash ?? null,
        },
      });
    } catch {
      // ignore dedupe / logging failures
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("/api/redeem/start error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
