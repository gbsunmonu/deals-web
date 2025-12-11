// app/api/redemptions/confirm/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = String(body?.payload || "").trim();

    if (!payload) {
      return NextResponse.json(
        { error: "Missing QR payload." },
        { status: 400 }
      );
    }

    // 1) Check if this exact QR text ("code") has already been redeemed
    const already = await prisma.redemption.findUnique({
      where: { code: payload }, // 👈 uses `code` field from Prisma model
    });

    if (already) {
      return NextResponse.json(
        {
          error:
            "This QR code has already been redeemed. Ask the customer to open a fresh code.",
        },
        { status: 400 }
      );
    }

    // 2) Parse the QR payload
    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return NextResponse.json(
        { error: "Invalid QR format. Could not parse payload." },
        { status: 400 }
      );
    }

    if (!parsed || parsed.type !== "DEAL" || !parsed.dealId) {
      return NextResponse.json(
        { error: "Invalid QR code data. Missing deal information." },
        { status: 400 }
      );
    }

    const dealId: string = parsed.dealId;
    const expiresAtIso: string | undefined = parsed.expiresAt;

    // 3) Load the deal
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found for this QR code." },
        { status: 404 }
      );
    }

    const now = new Date();

    // Check the deal is currently valid by dates
    if (deal.startsAt > now || deal.endsAt < now) {
      return NextResponse.json(
        { error: "This deal is not currently valid." },
        { status: 400 }
      );
    }

    // Optional: also honour expiresAt embedded in QR
    if (expiresAtIso) {
      const qrExpiry = new Date(expiresAtIso);
      if (qrExpiry < now) {
        return NextResponse.json(
          { error: "This QR code has expired." },
          { status: 400 }
        );
      }
    }

    // 4) Create redemption and lock this QR forever
    const redemption = await prisma.redemption.create({
      data: {
        dealId: deal.id,
        code: payload, // 👈 store full raw QR JSON here
      },
    });

    console.log("[Redemption] created:", redemption.id);

    // 5) Return summary used by RedeemForm
    return NextResponse.json({
      message: "Redemption successful. Code can no longer be used again.",
      deal: {
        id: deal.id,
        title: deal.title,
        originalPrice: deal.originalPrice,
        discountValue: deal.discountValue,
      },
    });
  } catch (err) {
    console.error("Redemption confirm error:", err);
    return NextResponse.json(
      { error: "Unexpected error confirming redemption." },
      { status: 500 }
    );
  }
}
