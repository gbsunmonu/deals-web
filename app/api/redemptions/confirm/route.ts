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
    // Also accept a raw short code directly.
    const maybeUrl = rawText;
    let scannedCode: string | null = null;

    if (/^https?:\/\//i.test(maybeUrl)) {
      try {
        const u = new URL(maybeUrl);
        const parts = u.pathname.split("/").filter(Boolean);
        // Expected: ["r", "ABC123"]
        scannedCode = parts.length ? parts[parts.length - 1] : null;
      } catch {
        // fall through
      }
    }

    // If it wasn't a URL, treat it as a raw short code
    if (!scannedCode) {
      scannedCode = maybeUrl.trim();
    }

    // --- 2) Legacy JSON payload support (older QR format)
    // If the scanned text looks like JSON, keep supporting it.
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

      // Legacy flow: create an immediate redeemed record (old behavior)
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

    // --- 3) Normal flow: look up redemption by shortCode (or code) and mark it redeemed
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

    const updated = await prisma.redemption.update({
      where: { id: redemption.id },
      data: { redeemedAt: new Date() },
      select: { id: true, redeemedAt: true },
    });

    const deal = redemption.deal;
    const original = deal.originalPrice ?? 0;
    const discount = deal.discountValue ?? 0;
    const hasDiscount = discount > 0 && original > 0;
    const discountedPrice = hasDiscount
      ? Math.round(original - (original * discount) / 100)
      : original || null;
    const savingsAmount =
      hasDiscount && discountedPrice != null ? original - discountedPrice : null;

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
