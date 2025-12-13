// app/api/redeem/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Simple code generator (uppercase, URL-safe-ish)
function makeShortCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function generateUniqueShortCode() {
  // Try a few times to avoid collisions
  for (let i = 0; i < 6; i++) {
    const shortCode = makeShortCode(6);
    const exists = await prisma.redemption.findUnique({
      where: { shortCode },
      select: { id: true },
    });
    if (!exists) return shortCode;
  }
  // fallback
  return makeShortCode(8);
}

export async function POST(req: NextRequest) {
  try {
    // Accept either JSON or raw text payloads
    const bodyText = await req.text();
    if (!bodyText) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    let payload: any = null;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      // If it's not JSON, treat it as a raw code string
      payload = { code: bodyText.trim() };
    }

    // Expected minimum:
    // payload.dealId (preferred) OR payload.dealSlug (if you use slugs)
    // payload.code OR payload.qrText / payload.text (from scanner)
    const dealId = payload?.dealId as string | undefined;

    // If your project uses slug instead of id, you can extend this easily,
    // but we won't guess that without seeing schema usage in this file.
    if (!dealId || typeof dealId !== "string") {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    const raw =
      payload?.code ??
      payload?.qrText ??
      payload?.text ??
      payload?.payload ??
      payload?.raw ??
      "";

    if (!raw || typeof raw !== "string") {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const rawText = raw.trim();
    if (!rawText) {
      return NextResponse.json({ error: "code is empty" }, { status: 400 });
    }

    // If the scanned value is a URL like https://domain.com/r/ABC123, extract the last path segment
    let code = rawText;
    if (/^https?:\/\//i.test(rawText)) {
      try {
        const u = new URL(rawText);
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length) code = parts[parts.length - 1];
      } catch {
        // leave `code` as rawText
      }
    }

    // 1) Ensure deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // 2) Find existing redemption by code/shortCode (to avoid double redeem)
    const existing = await prisma.redemption.findFirst({
      where: {
        OR: [{ code }, { shortCode: code }],
      },
      select: { id: true, redeemedAt: true },
    });

    if (existing?.redeemedAt) {
      return NextResponse.json(
        { ok: false, status: "ALREADY_REDEEMED", error: "This code has already been redeemed." },
        { status: 409 }
      );
    }

    // 3) If redemption exists but not redeemed, mark as redeemed.
    // Otherwise create a redemption and mark as redeemed.
    const now = new Date();

    if (existing && !existing.redeemedAt) {
      const updated = await prisma.redemption.update({
        where: { id: existing.id },
        data: { redeemedAt: now },
        select: { id: true, redeemedAt: true, shortCode: true },
      });

      return NextResponse.json(
        {
          ok: true,
          status: "REDEEMED",
          message: "Redemption successful.",
          redemption: { id: updated.id, redeemedAt: updated.redeemedAt, shortCode: updated.shortCode },
        },
        { status: 200 }
      );
    }

    // ✅ IMPORTANT FIX:
    // Prisma requires `shortCode` in Redemption create. We set it.
    // We keep `code` and `shortCode` aligned so either lookup works.
    const shortCode = await generateUniqueShortCode();

    try {
      const redemption = await prisma.redemption.create({
        data: {
          dealId: deal.id,
          code,              // scanned/entered code
          shortCode,         // REQUIRED by your Prisma schema
          redeemedAt: now,   // this route is "redeem now"
        },
        select: { id: true, redeemedAt: true, shortCode: true },
      });

      return NextResponse.json(
        {
          ok: true,
          status: "REDEEMED",
          message: "Redemption successful.",
          redemption: { id: redemption.id, redeemedAt: redemption.redeemedAt, shortCode: redemption.shortCode },
        },
        { status: 200 }
      );
    } catch (err: any) {
      // In case of unique collision
      if (err?.code === "P2002") {
        return NextResponse.json(
          { ok: false, status: "ALREADY_REDEEMED", error: "This code has already been redeemed." },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err: any) {
    console.error("[/api/redeem] error:", err);
    return NextResponse.json(
      { error: "Unexpected error redeeming deal", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
