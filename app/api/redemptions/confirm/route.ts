// app/api/redemptions/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Shape we expect inside the QR payload text
type DealQrPayload = {
  type: "DEAL";
  dealId: string;
  expiresAt?: string;
};

export async function POST(req: NextRequest) {
  try {
    // -----------------------------
    // 1. Read body as *text* first
    // -----------------------------
    const bodyText = await req.text();
    if (!bodyText) {
      return NextResponse.json(
        { error: "Missing request body" },
        { status: 400 }
      );
    }

    let rawText: string;

    // Try to parse as JSON object first
    // (e.g. { "qrText": "..." }). If that fails,
    // treat the whole body as the QR text itself.
    try {
      const parsed = JSON.parse(bodyText);
      if (typeof parsed === "string") {
        rawText = parsed;
      } else {
        rawText =
          parsed?.qrText ||
          parsed?.payload ||
          parsed?.text ||
          parsed?.raw ||
          parsed?.code ||
          bodyText;
      }
    } catch {
      rawText = bodyText.trim();
    }

    if (!rawText) {
      return NextResponse.json(
        { error: "QR text is empty" },
        { status: 400 }
      );
    }

    // ---------------------------------
    // 2. Decode the QR JSON payload
    // ---------------------------------
    let payload: DealQrPayload;
    try {
      payload = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "QR code is not valid JSON" },
        { status: 400 }
      );
    }

    if (payload.type !== "DEAL" || !payload.dealId) {
      return NextResponse.json(
        { error: "QR code is not a valid deal code" },
        { status: 400 }
      );
    }

    // Optional expiry check from payload
    if (payload.expiresAt) {
      const expires = new Date(payload.expiresAt);
      if (Number.isNaN(expires.getTime())) {
        return NextResponse.json(
          { error: "QR expiry is invalid" },
          { status: 400 }
        );
      }
      if (expires < new Date()) {
        return NextResponse.json(
          { error: "This QR code has expired" },
          { status: 400 }
        );
      }
    }

    // ---------------------------------
    // 3. Check that the deal exists
    // ---------------------------------
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found for this QR code" },
        { status: 404 }
      );
    }

    // ---------------------------------
    // 4. Create a redemption
    //    (code is UNIQUE, so re-use fails)
    // ---------------------------------
    try {
      const redemption = await prisma.redemption.create({
        data: {
          dealId: deal.id,
          code: rawText, // full QR payload text
          // redeemedAt uses default(now())
        },
      });

      return NextResponse.json(
        {
          ok: true,
          status: "REDEEMED",
          redemptionId: redemption.id,
          redeemedAt: redemption.redeemedAt,
        },
        { status: 200 }
      );
    } catch (err: any) {
      // Unique constraint -> already redeemed
      if (err?.code === "P2002") {
        return NextResponse.json(
          {
            ok: false,
            status: "ALREADY_REDEEMED",
            error: "This QR code has already been redeemed.",
          },
          { status: 409 }
        );
      }

      console.error("Error creating redemption:", err);
      return NextResponse.json(
        {
          error: "Unexpected error creating redemption",
          details: err?.message ?? String(err),
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Unexpected error in /api/redemptions/confirm:", err);
    return NextResponse.json(
      {
        error: "Unexpected error confirming redemption",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
