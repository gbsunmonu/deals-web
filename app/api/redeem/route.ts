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

    if (!body) {
      return badRequest("Missing JSON body.");
    }

    // We allow either { payload: "json-string" } or { payload: { ..object.. } }
    let rawPayload = (body as any).payload ?? body.payload ?? body;

    if (!rawPayload) {
      return badRequest("Missing `payload` in request body.");
    }

    let payload: DealQrPayload;

    try {
      if (typeof rawPayload === "string") {
        payload = JSON.parse(rawPayload);
      } else {
        payload = rawPayload as DealQrPayload;
      }
    } catch (err) {
      return badRequest("Could not parse QR payload JSON.");
    }

    // Basic validation of expected fields
    if (payload.v !== 1) {
      return badRequest("Unsupported payload version.");
    }

    if (payload.type !== "deal-redemption") {
      return badRequest("Unsupported payload type.");
    }

    if (!payload.dealId || !payload.code) {
      return badRequest("Payload missing dealId or code.");
    }

    const expiresAt = new Date(payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return badRequest("Invalid expiresAt value.");
    }

    const now = new Date();
    if (expiresAt.getTime() < now.getTime()) {
      return NextResponse.json(
        {
          ok: false,
          status: "EXPIRED",
          message: "This QR code has expired.",
        },
        { status: 410 }
      );
    }

    // 1) Check if this QR `code` was already redeemed
    const existingRedemption = await prisma.redemption.findUnique({
      where: { code: payload.code },
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

    // 2) Fetch the deal (with merchant) from DB
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
            phone: true,
          },
        },
      },
    });

    if (!deal) {
      return NextResponse.json(
        {
          ok: false,
          status: "INVALID_DEAL",
          message: "Deal not found for this QR code.",
        },
        { status: 404 }
      );
    }

    // Optional: double-check the deal's own date range
    if (deal.startsAt > now || deal.endsAt < now) {
      return NextResponse.json(
        {
          ok: false,
          status: "OUT_OF_RANGE",
          message: "This deal is not valid on today's date.",
        },
        { status: 400 }
      );
    }

    // 3) Create the redemption row (this marks the code as "used")
    const redemption = await prisma.redemption.create({
      data: {
        dealId: deal.id,
        code: payload.code,
      },
    });

    // 4) Calculate discount info for the response (optional but nice for UI)
    const original = deal.originalPrice ?? 0;
    const discount = deal.discountValue ?? 0;

    const hasDiscount = discount > 0 && original > 0;
    const discountedPrice = hasDiscount
      ? Math.round(original - (original * discount) / 100)
      : original || null;

    const savingsAmount =
      hasDiscount && discountedPrice != null
        ? original - discountedPrice
        : null;

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
