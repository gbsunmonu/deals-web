// app/api/redeem/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// This is a legacy redemption endpoint.
// It directly marks a redemption as redeemed at creation time.
//
// NOTE: Your schema now requires `expiresAt` and `deviceHash`,
// so we must provide them here as well.

type LegacyPayload = {
  dealId?: string;
  code?: string;
};

const QR_TTL_MINUTES = 15;

function addMinutes(date: Date, minutes: number) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    if (!bodyText) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    let payload: LegacyPayload = {};
    try {
      payload = JSON.parse(bodyText);
    } catch {
      // if someone posts raw text, try to treat it as code only
      payload = { code: bodyText.trim() };
    }

    const dealId = typeof payload.dealId === "string" ? payload.dealId : "";
    const code = typeof payload.code === "string" ? payload.code : "";

    if (!dealId || !code) {
      return NextResponse.json(
        { error: "dealId and code are required" },
        { status: 400 }
      );
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const now = new Date();

    // IMPORTANT: schema requires these:
    // - expiresAt: DateTime (required)
    // - deviceHash: String (required)
    //
    // Because this is a legacy route (no customer device fingerprint),
    // we use a deterministic legacy deviceHash that won’t collide.
    const deviceHash = `legacy:${dealId}:${code}`;
    const expiresAt = addMinutes(now, QR_TTL_MINUTES);

    // Create a redemption row already marked as redeemed
    const redemption = await prisma.redemption.create({
      data: {
        dealId: deal.id,
        code,
        shortCode: code, // legacy behavior: keep aligned
        redeemedAt: now,
        expiresAt,
        deviceHash,
      },
      select: {
        id: true,
        dealId: true,
        code: true,
        shortCode: true,
        redeemedAt: true,
        expiresAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        status: "REDEEMED",
        message: "Redemption successful.",
        redemption,
      },
      { status: 200 }
    );
  } catch (err: any) {
    // Prisma unique constraint (already redeemed / code reused)
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

    console.error("[/api/redeem] error:", err);
    return NextResponse.json(
      { error: "Unexpected error redeeming", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
