import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Backwards compatible payloads we may receive from QR scans:
// 1) A URL: https://your-domain.com/r/<shortCode>
// 2) A plain short code: ABC123
// 3) Old JSON payloads (legacy): {"type":"DEAL","dealId":"...","expiresAt":"..."}
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
  // fallback (very unlikely)
  return makeShortCode(8);
}

/**
 * Capacity enforcement, but safe under concurrency by running inside
 * a SERIALIZABLE transaction.
 */
async function confirmRedemptionWithCapacity(redemptionId: string) {
  return prisma.$transaction(
    async (tx) => {
      // Load redemption + deal inside the tx
      const redemption = await tx.redemption.findUnique({
        where: { id: redemptionId },
        select: {
          id: true,
          redeemedAt: true,
          dealId: true,
          shortCode: true,
          code: true,
          deal: {
            select: {
              id: true,
              title: true,
              originalPrice: true,
              discountValue: true,
              discountType: true,
              startsAt: true,
              endsAt: true,
              maxRedemptions: true,
              merchant: {
                select: { id: true, name: true, city: true, address: true, phone: true },
              },
            },
          },
        },
      });

      if (!redemption) {
        const err: any = new Error("Redemption code not found");
        err.status = 404;
        err.code = "NOT_FOUND";
        throw err;
      }

      if (redemption.redeemedAt) {
        const err: any = new Error("This QR code has already been redeemed.");
        err.status = 409;
        err.code = "ALREADY_REDEEMED";
        err.redeemedAt = redemption.redeemedAt;
        throw err;
      }

      const deal = redemption.deal;
      const now = new Date();

      // Expiry/valid window enforcement
      if (deal.startsAt && deal.startsAt > now) {
        const err: any = new Error("This deal has not started yet.");
        err.status = 400;
        err.code = "NOT_STARTED";
        throw err;
      }
      if (deal.endsAt && deal.endsAt < now) {
        const err: any = new Error("This deal has expired.");
        err.status = 400;
        err.code = "EXPIRED";
        throw err;
      }

      // Capacity enforcement
      const max = deal.maxRedemptions;
      if (typeof max === "number" && max > 0) {
        const redeemedCount = await tx.redemption.count({
          where: {
            dealId: deal.id,
            redeemedAt: { not: null as any },
          },
        });

        if (redeemedCount >= max) {
          const err: any = new Error("This deal has been fully redeemed.");
          err.status = 409;
          err.code = "SOLD_OUT";
          throw err;
        }
      }

      // Mark redeemed
      const updated = await tx.redemption.update({
        where: { id: redemption.id },
        data: { redeemedAt: new Date() },
        select: { id: true, redeemedAt: true },
      });

      // Compute savings for response
      const original = deal.originalPrice ?? 0;
      const discount = deal.discountValue ?? 0;
      const hasDiscount = discount > 0 && original > 0;
      const discountedPrice = hasDiscount
        ? Math.round(original - (original * discount) / 100)
        : original || null;
      const savingsAmount =
        hasDiscount && discountedPrice != null ? original - discountedPrice : null;

      return {
        updated,
        deal,
        merchant: deal.merchant,
        computed: { discountedPrice, savingsAmount },
      };
    },
    { isolationLevel: "Serializable" }
  );
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

    // --- 1) If it's a URL (/r/<code>), extract the last segment.
    const maybeUrl = rawText;
    let scannedCode: string | null = null;

    if (/^https?:\/\//i.test(maybeUrl)) {
      try {
        const u = new URL(maybeUrl);
        const parts = u.pathname.split("/").filter(Boolean);
        scannedCode = parts.length ? parts[parts.length - 1] : null;
      } catch {
        // fall through
      }
    }

    if (!scannedCode) scannedCode = maybeUrl.trim();

    // --- 2) Legacy JSON payload support (older QR format)
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
          return NextResponse.json({ error: "This QR code has expired" }, { status: 400 });
        }
      }

      // For legacy: capacity + expiry should still apply.
      const deal = await prisma.deal.findUnique({
        where: { id: legacy.dealId },
        select: { id: true, startsAt: true, endsAt: true, maxRedemptions: true },
      });

      if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

      const now = new Date();
      if (deal.startsAt && deal.startsAt > now) {
        return NextResponse.json({ error: "This deal has not started yet.", status: "NOT_STARTED" }, { status: 400 });
      }
      if (deal.endsAt && deal.endsAt < now) {
        return NextResponse.json({ error: "This deal has expired", status: "EXPIRED" }, { status: 400 });
      }

      if (typeof deal.maxRedemptions === "number" && deal.maxRedemptions > 0) {
        const redeemedCount = await prisma.redemption.count({
          where: { dealId: deal.id, redeemedAt: { not: null as any } },
        });

        if (redeemedCount >= deal.maxRedemptions) {
          return NextResponse.json(
            { ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." },
            { status: 409 }
          );
        }
      }

      // Create an immediate redeemed record (legacy behavior)
      try {
        const shortCode = await generateUniqueRedemptionShortCode();
        const redemption = await prisma.redemption.create({
          data: {
            dealId: legacy.dealId,
            code: scannedCode,
            shortCode,
            redeemedAt: new Date(),
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

    // --- 3) Normal flow: find redemption row then confirm inside SERIALIZABLE tx
    const found = await prisma.redemption.findFirst({
      where: { OR: [{ shortCode: scannedCode }, { code: scannedCode }] },
      select: { id: true },
    });

    if (!found) {
      return NextResponse.json({ error: "Redemption code not found" }, { status: 404 });
    }

    try {
      const result = await confirmRedemptionWithCapacity(found.id);

      const deal = result.deal;

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
            discountedPrice: result.computed.discountedPrice,
            savingsAmount: result.computed.savingsAmount,
            startsAt: deal.startsAt,
            endsAt: deal.endsAt,
            maxRedemptions: deal.maxRedemptions,
          },
          merchant: result.merchant,
          redemption: { id: result.updated.id, redeemedAt: result.updated.redeemedAt },
        },
        { status: 200 }
      );
    } catch (e: any) {
      if (e?.code === "ALREADY_REDEEMED") {
        return NextResponse.json(
          {
            ok: false,
            status: "ALREADY_REDEEMED",
            error: "This QR code has already been redeemed.",
            redeemedAt: e.redeemedAt ?? null,
          },
          { status: 409 }
        );
      }
      if (e?.code === "SOLD_OUT") {
        return NextResponse.json(
          { ok: false, status: "SOLD_OUT", error: "This deal has been fully redeemed." },
          { status: 409 }
        );
      }
      if (e?.code === "NOT_STARTED") {
        return NextResponse.json(
          { ok: false, status: "NOT_STARTED", error: "This deal has not started yet." },
          { status: 400 }
        );
      }
      if (e?.code === "EXPIRED") {
        return NextResponse.json(
          { ok: false, status: "EXPIRED", error: "This deal has expired." },
          { status: 400 }
        );
      }
      if (e?.status === 404) {
        return NextResponse.json({ error: "Redemption code not found" }, { status: 404 });
      }

      console.error("[/api/redemptions/confirm] error:", e);
      return NextResponse.json(
        { error: "Unexpected error confirming redemption", details: e?.message ?? String(e) },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Unexpected error in /api/redemptions/confirm:", err);
    return NextResponse.json(
      { error: "Unexpected error confirming redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
