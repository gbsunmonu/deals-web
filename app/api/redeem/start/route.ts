// app/api/redeem/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEVICE_COOKIE = "ytd_device";

// --- Policy knobs (tune later) ---
const QR_TTL_MINUTES = 15;

// A device can redeem at most this many deals per day (across all deals)
const MAX_REDEEMS_PER_DEVICE_PER_DAY = 5;

// A device can create at most this many QR sessions per day (across all deals)
// (prevents hammering the "Get QR" button for 500 deals in 2 minutes)
const MAX_QR_CREATES_PER_DEVICE_PER_DAY = 120;

// For a single deal, a device can "refresh" QR only this many times per day
// (prevents constant refresh to bypass TTL)
const MAX_QR_PER_DEAL_PER_DAY = 3;

// If blocked, advise client to retry after N seconds (optional)
const DEFAULT_RETRY_AFTER_SEC = 60 * 10; // 10 minutes

function rand(len = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function secondsUntilEndOfDay(now: Date) {
  const eod = endOfDay(now).getTime();
  return Math.max(1, Math.ceil((eod - now.getTime()) / 1000));
}

async function logBlock(args: {
  deviceHash: string;
  requestedDealId: string;
  blockedDealId?: string | null;
  blockedShortCode?: string | null;
  blockedExpiresAt?: Date | null;
  reason: string;
  retryAfterSec?: number | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.redemptionBlockLog.create({
      data: {
        deviceHash: args.deviceHash,
        requestedDealId: args.requestedDealId,
        blockedDealId: args.blockedDealId ?? null,
        blockedShortCode: args.blockedShortCode ?? null,
        blockedExpiresAt: args.blockedExpiresAt ?? null,
        reason: args.reason,
        retryAfterSec: args.retryAfterSec ?? null,
        userAgent: args.userAgent ?? null,
      },
    });
  } catch {
    // don't break the flow if logging fails
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dealId = String(body?.dealId || "").trim();

    if (!dealId) {
      return NextResponse.json({ error: "missing_dealId" }, { status: 400 });
    }

    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    const ua = req.headers.get("user-agent");

    // ---------- device cookie ----------
    let deviceHash = req.cookies.get(DEVICE_COOKIE)?.value || "";
    if (!deviceHash) deviceHash = `d_${rand(32)}`;

    // ---------- deal validation ----------
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        maxRedemptions: true,
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
    }

    const startsAt = new Date(deal.startsAt);
    const endsAt = new Date(deal.endsAt);

    if (now < startsAt) {
      return NextResponse.json({ error: "deal_not_started" }, { status: 409 });
    }
    if (now > endsAt) {
      return NextResponse.json({ error: "deal_ended" }, { status: 409 });
    }

    // ---------- DAILY REDEEM CAP (device-wide) ----------
    // Count redemptions that were actually redeemed today by this device.
    const redeemedTodayCount = await prisma.redemption.count({
      where: {
        deviceHash,
        redeemedAt: {
          not: null,
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    if (redeemedTodayCount >= MAX_REDEEMS_PER_DEVICE_PER_DAY) {
      const retryAfterSec = secondsUntilEndOfDay(now);

      await logBlock({
        deviceHash,
        requestedDealId: deal.id,
        reason: "daily_redeem_cap_reached",
        retryAfterSec,
        userAgent: ua,
      });

      const res = NextResponse.json(
        {
          error: "daily_redeem_cap_reached",
          message: `Daily limit reached (${MAX_REDEEMS_PER_DEVICE_PER_DAY}/day). Try again tomorrow.`,
          retryAfterSec,
        },
        { status: 429 }
      );

      res.cookies.set(DEVICE_COOKIE, deviceHash, {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      });

      return res;
    }

    // ---------- INVENTORY (Option A: only decreases at redeem time) ----------
    if (deal.maxRedemptions && deal.maxRedemptions > 0) {
      const redeemedCount = await prisma.redemption.count({
        where: { dealId, redeemedAt: { not: null } },
      });

      if (redeemedCount >= deal.maxRedemptions) {
        return NextResponse.json({ error: "sold_out" }, { status: 409 });
      }
    }

    // ---------- QR CREATE CAP (device-wide) ----------
    // This counts all QR sessions created today by this device (redeemed or not).
    const qrCreatedTodayCount = await prisma.redemption.count({
      where: {
        deviceHash,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
    });

    if (qrCreatedTodayCount >= MAX_QR_CREATES_PER_DEVICE_PER_DAY) {
      await logBlock({
        deviceHash,
        requestedDealId: deal.id,
        reason: "daily_qr_create_cap_reached",
        retryAfterSec: DEFAULT_RETRY_AFTER_SEC,
        userAgent: ua,
      });

      const res = NextResponse.json(
        {
          error: "daily_qr_create_cap_reached",
          message: "Too many QR requests today. Please wait and try again.",
          retryAfterSec: DEFAULT_RETRY_AFTER_SEC,
        },
        { status: 429 }
      );

      res.cookies.set(DEVICE_COOKIE, deviceHash, {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      });

      return res;
    }

    // ---------- PER-DEAL PER-DAY RULES ----------
    // 1) If redeemed today for this deal -> block
    const redeemedThisDealToday = await prisma.redemption.findFirst({
      where: {
        dealId,
        deviceHash,
        redeemedAt: { not: null },
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true, redeemedAt: true },
    });

    if (redeemedThisDealToday) {
      await logBlock({
        deviceHash,
        requestedDealId: deal.id,
        reason: "already_redeemed_today_for_deal",
        retryAfterSec: secondsUntilEndOfDay(now),
        userAgent: ua,
      });

      return NextResponse.json(
        {
          error: "already_redeemed_today",
          message: "You already redeemed this deal today. Try again tomorrow.",
        },
        { status: 409 }
      );
    }

    // 2) Per-deal refresh cap (how many QR sessions created today for this deal+device)
    const qrThisDealTodayCount = await prisma.redemption.count({
      where: {
        dealId,
        deviceHash,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
    });

    if (qrThisDealTodayCount >= MAX_QR_PER_DEAL_PER_DAY) {
      await logBlock({
        deviceHash,
        requestedDealId: deal.id,
        reason: "per_deal_qr_refresh_cap_reached",
        retryAfterSec: DEFAULT_RETRY_AFTER_SEC,
        userAgent: ua,
      });

      return NextResponse.json(
        {
          error: "per_deal_qr_refresh_cap_reached",
          message: "Too many refreshes for this deal today. Please wait and try again.",
          retryAfterSec: DEFAULT_RETRY_AFTER_SEC,
        },
        { status: 429 }
      );
    }

    // 3) If there is an existing QR today that hasn't expired, reuse it
    const existing = await prisma.redemption.findFirst({
      where: {
        dealId,
        deviceHash,
        redeemedAt: null,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { createdAt: "desc" },
      select: {
        shortCode: true,
        expiresAt: true,
      },
    });

    if (existing?.expiresAt && now < new Date(existing.expiresAt)) {
      const res = NextResponse.json({
        shortCode: existing.shortCode,
        expiresAt: new Date(existing.expiresAt).toISOString(),
        reused: true,
      });

      res.cookies.set(DEVICE_COOKIE, deviceHash, {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      });

      return res;
    }

    // ---------- CREATE NEW QR ----------
    const expiresAt = new Date(now.getTime() + QR_TTL_MINUTES * 60 * 1000);

    // Schema requires BOTH `code` and `shortCode`
    const shortCode = rand(6);
    const code = `c_${rand(28)}`;

    const created = await prisma.redemption.create({
      data: {
        dealId,
        deviceHash,
        shortCode,
        code,
        expiresAt,
      },
      select: { shortCode: true, expiresAt: true },
    });

    const res = NextResponse.json({
      shortCode: created.shortCode,
      expiresAt: created.expiresAt.toISOString(),
      reused: false,
    });

    res.cookies.set(DEVICE_COOKIE, deviceHash, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });

    return res;
  } catch (e: any) {
    console.error("redeem/start error:", e);
    return NextResponse.json(
      { error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
