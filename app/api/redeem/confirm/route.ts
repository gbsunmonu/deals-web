// app/api/redeem/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// --- Policy knobs ---
const MAX_REDEEMS_PER_DEVICE_PER_DAY = 5;

function clampCode(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isCodeLike(s: string) {
  return /^[A-Z0-9]{4,12}$/.test(s);
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
  deviceHash?: string | null;
  requestedDealId: string;
  blockedDealId?: string | null;
  blockedShortCode?: string | null;
  blockedExpiresAt?: Date | null;
  reason: string;
  retryAfterSec?: number | null;
  userAgent?: string | null;
}) {
  try {
    // deviceHash is required in schema, so only log if we have it
    if (!args.deviceHash) return;

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
    // don't block redemption if logging fails
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Merchant auth
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id as any },
      select: { id: true, name: true },
    });

    if (!merchant) {
      return NextResponse.json({ error: "not_a_merchant" }, { status: 403 });
    }

    // ✅ Input
    const body = await req.json().catch(() => ({}));
    const shortCode = clampCode(body?.shortCode);

    if (!shortCode || !isCodeLike(shortCode)) {
      return NextResponse.json(
        { error: "invalid_code", message: "Invalid short code." },
        { status: 400 }
      );
    }

    const now = new Date();
    const ua = req.headers.get("user-agent");

    // ✅ Load redemption + deal (we also need deviceHash for daily cap)
    const redemption = await prisma.redemption.findUnique({
      where: { shortCode },
      select: {
        id: true,
        shortCode: true,
        deviceHash: true,
        redeemedAt: true,
        expiresAt: true,
        dealId: true,
        deal: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            maxRedemptions: true,
            merchantId: true,
            discountType: true,
            discountValue: true,
            originalPrice: true,
          },
        },
      },
    });

    if (!redemption) {
      return NextResponse.json(
        { error: "not_found", message: "QR code not found." },
        { status: 404 }
      );
    }

    // ✅ Must belong to THIS merchant
    if (redemption.deal.merchantId !== merchant.id) {
      await logBlock({
        deviceHash: redemption.deviceHash ?? null,
        requestedDealId: redemption.deal.id,
        blockedDealId: redemption.deal.id,
        blockedShortCode: redemption.shortCode,
        blockedExpiresAt: redemption.expiresAt ?? null,
        reason: "wrong_merchant_attempt",
        retryAfterSec: null,
        userAgent: ua,
      });

      return NextResponse.json(
        { error: "wrong_merchant", message: "This QR is not for your store." },
        { status: 403 }
      );
    }

    // ✅ Deal must be live
    const dealStarts = new Date(redemption.deal.startsAt);
    const dealEnds = new Date(redemption.deal.endsAt);

    if (now < dealStarts) {
      return NextResponse.json(
        {
          error: "deal_not_started",
          message: "This deal has not started yet.",
          startsAt: dealStarts.toISOString(),
        },
        { status: 409 }
      );
    }

    if (now > dealEnds) {
      return NextResponse.json(
        {
          error: "deal_ended",
          message: "This deal has ended.",
          endsAt: dealEnds.toISOString(),
        },
        { status: 409 }
      );
    }

    // ✅ QR must not be expired
    const expiresAt = redemption.expiresAt ? new Date(redemption.expiresAt) : null;
    if (!expiresAt || now >= expiresAt) {
      await logBlock({
        deviceHash: redemption.deviceHash ?? null,
        requestedDealId: redemption.deal.id,
        blockedDealId: redemption.deal.id,
        blockedShortCode: redemption.shortCode,
        blockedExpiresAt: redemption.expiresAt ?? null,
        reason: "expired_qr_attempt",
        retryAfterSec: null,
        userAgent: ua,
      });

      return NextResponse.json(
        { error: "expired", message: "This QR code has expired." },
        { status: 409 }
      );
    }

    // ✅ Must not be already redeemed
    if (redemption.redeemedAt) {
      return NextResponse.json(
        {
          error: "already_redeemed",
          message: "This QR has already been redeemed.",
          redeemedAt: redemption.redeemedAt.toISOString(),
        },
        { status: 409 }
      );
    }

    // ✅ DAILY REDEEM CAP (device-wide) at confirm-time too
    // This ensures the rule is enforced at the final moment.
    if (redemption.deviceHash) {
      const dayStart = startOfDay(now);
      const dayEnd = endOfDay(now);

      const redeemedTodayCount = await prisma.redemption.count({
        where: {
          deviceHash: redemption.deviceHash,
          redeemedAt: { not: null, gte: dayStart, lte: dayEnd },
        },
      });

      if (redeemedTodayCount >= MAX_REDEEMS_PER_DEVICE_PER_DAY) {
        const retryAfterSec = secondsUntilEndOfDay(now);

        await logBlock({
          deviceHash: redemption.deviceHash,
          requestedDealId: redemption.deal.id,
          blockedDealId: redemption.deal.id,
          blockedShortCode: redemption.shortCode,
          blockedExpiresAt: redemption.expiresAt ?? null,
          reason: "daily_redeem_cap_reached_at_confirm",
          retryAfterSec,
          userAgent: ua,
        });

        return NextResponse.json(
          {
            error: "daily_redeem_cap_reached",
            message: `Daily limit reached (${MAX_REDEEMS_PER_DEVICE_PER_DAY}/day). Try again tomorrow.`,
            retryAfterSec,
          },
          { status: 429 }
        );
      }
    }

    // ✅ Inventory enforcement (Option A): only decreases at redeem time
    if (redemption.deal.maxRedemptions && redemption.deal.maxRedemptions > 0) {
      const redeemedCount = await prisma.redemption.count({
        where: { dealId: redemption.deal.id, redeemedAt: { not: null } },
      });

      if (redeemedCount >= redemption.deal.maxRedemptions) {
        await logBlock({
          deviceHash: redemption.deviceHash ?? null,
          requestedDealId: redemption.deal.id,
          blockedDealId: redemption.deal.id,
          blockedShortCode: redemption.shortCode,
          blockedExpiresAt: redemption.expiresAt ?? null,
          reason: "sold_out_at_confirm",
          retryAfterSec: null,
          userAgent: ua,
        });

        return NextResponse.json(
          { error: "sold_out", message: "This deal is sold out." },
          { status: 409 }
        );
      }
    }

    // ✅ Redeem now (single source of truth)
    await prisma.redemption.update({
      where: { id: redemption.id },
      data: { redeemedAt: now },
      select: { id: true },
    });

    return NextResponse.json({
      ok: true,
      shortCode: redemption.shortCode,
      redeemedAt: now.toISOString(),
      deal: {
        id: redemption.deal.id,
        title: redemption.deal.title,
        discountType: String(redemption.deal.discountType),
        discountValue: Number(redemption.deal.discountValue ?? 0),
        originalPrice: redemption.deal.originalPrice ?? null,
      },
      merchant: {
        id: merchant.id,
        name: merchant.name,
      },
    });
  } catch (e: any) {
    console.error("redeem/confirm error:", e);
    return NextResponse.json(
      { error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
