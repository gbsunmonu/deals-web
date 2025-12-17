// app/api/redemptions/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function generateUniqueShortCode() {
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

// Simple device id (cookie-based). Works without login.
function getOrSetDeviceId(req: NextRequest, res: NextResponse) {
  const existing = req.cookies.get("dealina_device")?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  res.cookies.set("dealina_device", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return id;
}

function computeLeftAndSoldOut(max: number | null, redeemedCount: number) {
  const limited = typeof max === "number" && max > 0;
  const left = limited ? Math.max(max - redeemedCount, 0) : null;
  const soldOut = limited ? redeemedCount >= max : false;
  return { left, soldOut };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dealId = String(body?.dealId || "").trim();

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    const res = NextResponse.next();
    const deviceHash = getOrSetDeviceId(req, res);
    const activeKey = `${dealId}:${deviceHash}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const out = await prisma.$transaction(async (tx) => {
      // 0) Clean any expired “activeKey” rows so unique(activeKey) doesn't block
      await tx.redemption.updateMany({
        where: { activeKey, redeemedAt: null, expiresAt: { lte: now } },
        data: { activeKey: null },
      });

      // 1) If device already has an active QR for this deal and it's still valid → reuse it
      const existing = await tx.redemption.findFirst({
        where: {
          activeKey,
          redeemedAt: null,
          expiresAt: { gt: now },
        },
        select: {
          id: true,
          shortCode: true,
          code: true,
          expiresAt: true,
          dealId: true,
        },
      });

      if (existing) {
        return {
          kind: "REUSED" as const,
          shortCode: existing.shortCode,
          code: existing.code,
          expiresAt: existing.expiresAt,
        };
      }

      // 2) Enforce sold-out (if limited)
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        select: { id: true, title: true, maxRedemptions: true, endsAt: true, startsAt: true },
      });
      if (!deal) return { kind: "DEAL_NOT_FOUND" as const };

      // Deal time validity
      if (deal.startsAt > now) return { kind: "NOT_STARTED" as const };
      if (deal.endsAt < now) return { kind: "DEAL_EXPIRED" as const };

      // Capacity (only redeemedAt not null)
      const redeemedCount = await tx.redemption.count({
        where: { dealId, redeemedAt: { not: null } },
      });

      const { left, soldOut } = computeLeftAndSoldOut(deal.maxRedemptions ?? null, redeemedCount);

      if (soldOut) {
        return {
          kind: "SOLD_OUT" as const,
          left,
          redeemedCount,
          maxRedemptions: deal.maxRedemptions ?? null,
        };
      }

      // 3) Create new QR (15-min expiry)
      const shortCode = await generateUniqueShortCode();

      const created = await tx.redemption.create({
        data: {
          dealId,
          shortCode,
          code: shortCode, // simple scan payload
          redeemedAt: null,
          createdAt: now,
          expiresAt,
          deviceHash,
          activeKey,
        },
        select: { id: true, shortCode: true, expiresAt: true },
      });

      return {
        kind: "CREATED" as const,
        shortCode: created.shortCode,
        expiresAt: created.expiresAt,
      };
    });

    // attach cookie to response (if we generated one)
    if (out.kind === "DEAL_NOT_FOUND") {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    if (out.kind === "NOT_STARTED") {
      return NextResponse.json({ ok: false, status: "NOT_STARTED", error: "Deal has not started yet." }, { status: 409 });
    }
    if (out.kind === "DEAL_EXPIRED") {
      return NextResponse.json({ ok: false, status: "DEAL_EXPIRED", error: "Deal has expired." }, { status: 410 });
    }
    if (out.kind === "SOLD_OUT") {
      return NextResponse.json(
        {
          ok: false,
          status: "SOLD_OUT",
          error: "This deal is sold out.",
          left: out.left,
          redeemedCount: out.redeemedCount,
          maxRedemptions: out.maxRedemptions,
        },
        { status: 409 }
      );
    }

    // Success: return JSON with expiresAt for countdown
    const payload = {
      ok: true,
      status: out.kind,
      shortCode: out.shortCode,
      expiresAt: out.expiresAt,
      qrUrl: `/r/${out.shortCode}`,
      qrText: `${req.nextUrl.origin}/r/${out.shortCode}`,
    };

    // If we used NextResponse.next() for cookie, convert to JSON response while preserving cookie
    const json = NextResponse.json(payload, { status: 200 });
    // copy cookies (device id) into the json response
    for (const c of res.cookies.getAll()) json.cookies.set(c);
    return json;
  } catch (err: any) {
    console.error("[redemptions/create] error:", err);
    return NextResponse.json(
      { error: "Failed to create redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
