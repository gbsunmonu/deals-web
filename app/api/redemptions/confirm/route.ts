// app/api/redemptions/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Shape we expect inside the QR payload text
type DealQrPayload = {
  type: "DEAL";
  dealId: string;
  expiresAt?: string;
};

function normalizeRawText(input: string) {
  // normalize whitespace + remove accidental leading/trailing newlines/spaces
  return input.replace(/\r\n/g, "\n").trim();
}

export async function POST(req: NextRequest) {
  try {
    // ------------------------------------------------------
    // 1) Read request body (supports JSON or plain text)
    // ------------------------------------------------------
    const contentType = req.headers.get("content-type") || "";
    let rawText = "";

    if (contentType.includes("application/json")) {
      // JSON payload (recommended)
      const body = await req.json().catch(() => null);

      rawText =
        typeof body === "string"
          ? body
          : body?.qrText ||
            body?.payload ||
            body?.text ||
            body?.raw ||
            body?.code ||
            "";
    } else {
      // Text payload
      const bodyText = await req.text();
      rawText = bodyText || "";
    }

    rawText = normalizeRawText(rawText);

    if (!rawText) {
      return NextResponse.json({ error: "QR text is empty" }, { status: 400 });
    }

    // ------------------------------------------------------
    // 2) Decode QR payload (must be JSON)
    // ------------------------------------------------------
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

    // Optional expiry check embedded in the QR payload
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

    // ------------------------------------------------------
    // 3) Fetch deal and validate it is ACTIVE
    // ------------------------------------------------------
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      select: { id: true, startsAt: true, endsAt: true },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found for this QR code" },
        { status: 404 }
      );
    }

    const now = new Date();
    if (deal.startsAt > now) {
      return NextResponse.json(
        { error: "Deal has not started yet" },
        { status: 400 }
      );
    }
    if (deal.endsAt < now) {
      return NextResponse.json(
        { error: "Deal has expired" },
        { status: 400 }
      );
    }

    // ------------------------------------------------------
    // 4) Create redemption (code is UNIQUE)
    // ------------------------------------------------------
    try {
      const redemption = await prisma.redemption.create({
        data: {
          dealId: deal.id,
          code: rawText, // full QR payload string
          // redeemedAt uses default(now())
        },
        select: { id: true, redeemedAt: true },
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
    } catch (err: unknown) {
      // ✅ Correct Prisma error handling
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint -> already redeemed
        if (err.code === "P2002") {
          return NextResponse.json(
            {
              ok: false,
              status: "ALREADY_REDEEMED",
              error: "This QR code has already been redeemed.",
            },
            { status: 409 }
          );
        }
      }

      console.error("[/api/redemptions/confirm] create redemption error:", err);
      return NextResponse.json(
        {
          error: "Unexpected error creating redemption",
        },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    console.error("[/api/redemptions/confirm] unexpected:", err);
    return NextResponse.json(
      { error: "Unexpected error confirming redemption" },
      { status: 500 }
    );
  }
}
