// app/api/redemptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrSetAnonDeviceId, hashDeviceId } from "@/lib/anonDevice";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QR_TTL_MINUTES = 15;

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

export async function POST(req: NextRequest) {
  // Create a response so we can set cookies if needed
  const cookieRes = NextResponse.next();

  try {
    const body = await req.json().catch(() => ({}));

    const dealId = body?.dealId as string | undefined;
    if (!dealId || typeof dealId !== "string") {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    const providedCode = body?.code;
    const code =
      typeof providedCode === "string" && providedCode.trim()
        ? providedCode.trim()
        : await generateUniqueShortCode();

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // ✅ Required by schema
    const deviceId = getOrSetAnonDeviceId(req, cookieRes);
    const deviceHash = hashDeviceId(deviceId);
    const expiresAt = new Date(Date.now() + QR_TTL_MINUTES * 60 * 1000);

    // Create redemption (NOT redeemed yet)
    try {
      const redemption = await prisma.redemption.create({
        data: {
          dealId: deal.id,
          code,
          shortCode: code,
          redeemedAt: null,
          expiresAt,
          deviceHash,
        },
        select: {
          id: true,
          code: true,
          shortCode: true,
          redeemedAt: true,
          expiresAt: true,
        },
      });

      const out = NextResponse.json(redemption, { status: 201 });
      cookieRes.cookies.getAll().forEach((c) => out.cookies.set(c));
      return out;
    } catch (err: any) {
      if (err?.code === "P2002") {
        const fallback = await generateUniqueShortCode();

        const redemption = await prisma.redemption.create({
          data: {
            dealId: deal.id,
            code: fallback,
            shortCode: fallback,
            redeemedAt: null,
            expiresAt,
            deviceHash,
          },
          select: {
            id: true,
            code: true,
            shortCode: true,
            redeemedAt: true,
            expiresAt: true,
          },
        });

        const out = NextResponse.json(redemption, { status: 201 });
        cookieRes.cookies.getAll().forEach((c) => out.cookies.set(c));
        return out;
      }

      throw err;
    }
  } catch (err: any) {
    console.error("[/api/redemptions] error:", err);
    return NextResponse.json(
      { error: "Failed to create redemption", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
