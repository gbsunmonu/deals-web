// app/api/redemptions/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Accept:
// 1) URL: https://domain/r/<shortCode>
// 2) Short code: ABC123
// 3) Legacy JSON payloads: {"type":"DEAL","dealId":"...","expiresAt":"..."}
type LegacyDealQrPayload = {
  type: "DEAL";
  dealId: string;
  expiresAt?: string;
};

function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function generateUniqueRedemptionShortCode() {
  for (let i = 0; i < 5; i++) {
    const shortCode = makeShortCode(6);
    const exists = await prisma.redemption.findUnique({
      where: { shortCode },
      select: { id: true },
    });
    if (!exists) return shortCode;
  }
  return makeShortCode(8);
}

async function enforceDealCapacityOrThrow(dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, maxRedemptions: true },
  });

  if (!deal) {
    const err: any = new Error("Deal not found");
    err.status = 404;
    err.code = "DEAL_NOT_FOUND";
    throw err;
  }

  const max = deal.maxRedemptions;

  // null/undefined/0 => unlimited
  if (typeof max !== "number" || max <= 0) return;

  const redeemedCount = await prisma.redemption.count({
    where: {
      dealId,
      redeemedAt: { not: null },
    },
  });

  if (redeemedCount >= max) {
    const err: any = new Error("This deal has been fully redeemed.");
    err.status = 409;
    err.code = "SOLD_OUT";
    throw err;
  }
}

function extractCode(rawText: string): string {
  const maybeUrl = rawText.trim();

  if (/^https?:\/\//i.test(maybeUrl)) {
    try {
      const u = new URL(maybeUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts.length ? parts[parts.length - 1] : maybeUrl;
    } catch {
      return maybeUrl;
    }
  }

  return maybeUrl;
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    if (!bodyText) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    let rawText = "";
    try {
      const parsed = JSON.parse(bodyText);
      rawText =
        typeof parsed === "string"
          ? parsed
          : parsed?.qrText ||
            parsed?.payload ||
            parsed?.text ||
            parsed?.raw ||
            parsed?.code ||
            bodyText;
    } catch {
      rawText = bodyText.trim();
    }

    rawText = String(rawText ?? "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "QR text is empty" }, { status: 400 });
    }

    const scannedCode = extractCode(rawText);

    // --- Legacy JSON payload support
    if (scannedCode.startsWith("{") && scannedCode.endsWith("}")) {
      let legacy: LegacyDealQrPayload;
      try {
        legacy = JSON.parse(scannedCode);
      } catch {
        return NextResponse.json({ error: "QR code is not a valid deal code" }, { status: 400 });
      }

      if (legacy.type !== "DEAL" || !legacy.dealId) {
        return NextResponse.json({ error: "QR code is not a valid deal code" }, { status: 400 });
      }

      if (legacy.expiresAt) {
        const expires = new Date(legacy.expiresAt);
        if (Number.isNaN(expires.getTime())) {
          return NextResponse.json({ error: "QR expiry is invalid" }, { status: 400 });
        }
        if (expires < new Date()) {
          return NextResponse.json({ ok: false, status: "EXPIRED", error: "This QR code has expired." }, { status: 410 });
        }
      }

      // enforce capacity
      try {
        await enforceDealCapacityOrThrow(legacy.dealId);
      } catch (e: any) {
        if (e?.code === "SOLD_OUT") {
          return NextResponse.json(
            { ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." },
            { status: 409 }
          );
        }
        if (e?.status === 404) {
          return NextResponse.json({ error: "Deal not found" }, { status: 404 });
        }
        console.error("[/api/redemptions/confirm] capacity check error:", e);
        return NextResponse.json(
          { error: "Unexpected error confirming redemption", details: e?.message ?? String(e) },
          { status: 500 }
        );
      }

      // legacy creates redeemed record immediately
      try {
        const shortCode = await generateUniqueRedemptionShortCode();
        const redemption = await prisma.redemption.create({
          data: {
            dealId: legacy.dealId,
            code: scannedCode,
            shortCode,
            redeemedAt: new Date(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            deviceHash: "legacy",
            activeKey: null,
          },
          select: { id: true, redeemedAt: true, shortCode: true },
        });

        return NextResponse.json(
          {
            ok: true,
            status: "REDEEMED",
            message: "Redemption successful.",
            redemption: { id: redemption.id, redeemedAt: redemption.redeemedAt },
          },
          { status: 200 }
        );
      } catch (err: any) {
        if (err?.code === "P2002") {
          return NextResponse.json(
            { ok: false, status: "ALREADY_REDEEMED", error: "This QR code has already been redeemed." },
            { status: 409 }
          );
        }

        console.error("[/api/redemptions/confirm] legacy create error:", err);
        return NextResponse.json(
          { error: "Unexpected error confirming redemption", details: err?.message ?? String(err) },
          { status: 500 }
        );
      }
    }

    // --- Normal flow: find redemption by shortCode or code
    const redemption = await prisma.redemption.findFirst({
      where: {
        OR: [{ shortCode: scannedCode }, { code: scannedCode }],
      },
      include: {
        deal: {
          include: {
            merchant: {
              select: { id: true, name: true, city: true, address: true, phone: true },
            },
          },
        },
      },
    });

    if (!redemption) {
      return NextResponse.json({ error: "Redemption code not found" }, { status: 404 });
    }

    // ✅ expiry check (15 minutes)
    const now = new Date();
    if (redemption.expiresAt && redemption.expiresAt <= now && !redemption.redeemedAt) {
      // clear activeKey so they can generate a new QR
      await prisma.redemption.update({
        where: { id: redemption.id },
        data: { activeKey: null },
        select: { id: true },
      });

      return NextResponse.json(
        { ok: false, status: "EXPIRED", error: "This QR code has expired. Please generate a new one." },
        { status: 410 }
      );
    }

    if (redemption.redeemedAt) {
      return NextResponse.json(
        {
          ok: false,
          status: "ALREADY_REDEEMED",
          error: "This QR code has already been redeemed.",
          redeemedAt: redemption.redeemedAt,
        },
        { status: 409 }
      );
    }

    // ✅ capacity check before redeeming
    try {
      await enforceDealCapacityOrThrow(redemption.dealId);
    } catch (e: any) {
      if (e?.code === "SOLD_OUT") {
        return NextResponse.json(
          { ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." },
          { status: 409 }
        );
      }
      if (e?.status === 404) {
        return NextResponse.json({ error: "Deal not found" }, { status: 404 });
      }
      console.error("[/api/redemptions/confirm] capacity check error:", e);
      return NextResponse.json(
        { error: "Unexpected error confirming redemption", details: e?.message ?? String(e) },
        { status: 500 }
      );
    }

    // ✅ redeem and clear lock
    const updated = await prisma.redemption.update({
      where: { id: redemption.id },
      data: {
        redeemedAt: new Date(),
        activeKey: null, // unlock for future QR
      },
      select: { id: true, redeemedAt: true },
    });

    const deal = redemption.deal;
    const original = deal.originalPrice ?? 0;
    const discount = deal.discountValue ?? 0;
    const hasDiscount = discount > 0 && original > 0;
    const discountedPrice = hasDiscount
      ? Math.round(original - (original * discount) / 100)
      : original || null;
    const savingsAmount = hasDiscount && discountedPrice != null ? original - discountedPrice : null;

    return NextResponse.json(
      {
        ok: true,
        status: "REDEEMED",
        message: "Redemption successful.",
        deal: {
          id: deal.id,
          title: deal.title,
          originalPrice: deal.originalPrice,
          discountValue: deal.discountValue,
          discountType: deal.discountType,
          discountedPrice,
          savingsAmount,
          startsAt: deal.startsAt,
          endsAt: deal.endsAt,
          maxRedemptions: deal.maxRedemptions ?? null,
        },
        merchant: deal.merchant,
        redemption: { id: updated.id, redeemedAt: updated.redeemedAt },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Unexpected error in /api/redemptions/confirm:", err);
    return NextResponse.json(
      { error: "Unexpected error confirming redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
