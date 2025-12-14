// app/api/redeem/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type DealQrPayload = {
  v: number;
  type: "deal-redemption";
  dealId: string;
  code: string;
  issuedAt: string;
  expiresAt: string;
};

function badRequest(message: string, statusCode = 400) {
  return NextResponse.json(
    {
      ok: false,
      status: "INVALID",
      message,
    },
    { status: statusCode }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) return badRequest("Missing JSON body.");

    // Allow either { payload: "json-string" } or { payload: { ..object.. } } or raw object
    const rawPayload = (body as any).payload ?? body.payload ?? body;
    if (!rawPayload) return badRequest("Missing `payload` in request body.");

    let payload: DealQrPayload;
    try {
      payload = typeof rawPayload === "string" ? JSON.parse(rawPayload) : (rawPayload as DealQrPayload);
    } catch {
      return badRequest("Could not parse QR payload JSON.");
    }

    // Validate expected fields
    if (payload.v !== 1) return badRequest("Unsupported payload version.");
    if (payload.type !== "deal-redemption") return badRequest("Unsupported payload type.");
    if (!payload.dealId || !payload.code) return badRequest("Payload missing dealId or code.");

    const expiresAt = new Date(payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) return badRequest("Invalid expiresAt value.");

    const now = new Date();
    if (expiresAt.getTime() < now.getTime()) {
      return NextResponse.json(
        { ok: false, status: "EXPIRED", message: "This QR code has expired." },
        { status: 410 }
      );
    }

    // 1) Check if this QR `code` was already redeemed
    // Use findFirst (not findUnique) to avoid schema uniqueness dependency.
    const existingRedemption = await prisma.redemption.findFirst({
      where: { code: payload.code },
      select: { id: true, redeemedAt: true },
    });

    if (existingRedemption) {
      return NextResponse.json(
        {
          ok: false,
          status: "ALREADY_REDEEMED",
          message: "This QR code has already been used.",
          redeemedAt: existingRedemption.redeemedAt,
        },
        { status: 409 }
      );
    }

    // 2) Fetch the deal (with merchant) from DB + maxRedemptions
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: {
        merchant: {
          select: { id: true, name: true, city: true, address: true, phone: true },
        },
      },
    });

    if (!deal) {
      return NextResponse.json(
        { ok: false, status: "INVALID_DEAL", message: "Deal not found for this QR code." },
        { status: 404 }
      );
    }

    // Double-check deal validity window
    if (deal.startsAt > now || deal.endsAt < now) {
      return NextResponse.json(
        { ok: false, status: "OUT_OF_RANGE", message: "This deal is not valid on today's date." },
        { status: 400 }
      );
    }

    // Optional: enforce maxRedemptions here too (same as confirm route)
    if (typeof (deal as any).maxRedemptions === "number" && (deal as any).maxRedemptions > 0) {
      const redeemedCount = await prisma.redemption.count({
        where: { dealId: deal.id, redeemedAt: { not: null as any } },
      });

      if (redeemedCount >= (deal as any).maxRedemptions) {
        return NextResponse.json(
          { ok: false, status: "SOLD_OUT", message: "This deal has been fully redeemed." },
          { status: 409 }
        );
      }
    }

    // 3) Create the redemption row (marks the code as "used")
    // IMPORTANT: Redemption.shortCode is required in your schema now.
    // For this legacy endpoint, we keep it aligned with code.
    const redemption = await prisma.redemption.create({
      data: {
        dealId: deal.id,
        code: payload.code,
        shortCode: payload.code, // ✅ satisfy schema requirement
        redeemedAt: new Date(),
      },
      select: { id: true, redeemedAt: true },
    });

    // 4) Calculate discount info for the response
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
        message: "QR code redeemed successfully.",
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
          maxRedemptions: (deal as any).maxRedemptions ?? null,
        },
        merchant: deal.merchant,
        redemption: {
          id: redemption.id,
          redeemedAt: redemption.redeemedAt,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[Redeem] Unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        status: "SERVER_ERROR",
        message: "Something went wrong while redeeming this QR code.",
      },
      { status: 500 }
    );
  }
}
