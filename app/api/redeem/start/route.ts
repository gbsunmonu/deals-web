// app/api/redeem/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// 15 minutes QR lifetime
const TTL_MINUTES = 15;

function getExpiryDate() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + TTL_MINUTES);
  return d;
}

function randomCode(len = 5) {
  // easy-to-read uppercase code
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid O/0/I/1
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// "device lock" hash from request fingerprint inputs.
// Keep it stable but not too identifying.
function computeDeviceHash(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const acceptLang = req.headers.get("accept-language") || "";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const raw = `${ua}|${acceptLang}|${ip}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const dealId = String(body?.dealId || "").trim();
    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    const deviceHash = computeDeviceHash(req);
    const now = new Date();
    const expiresAtNew = getExpiryDate();

    // Optional: validate deal exists & is not expired
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, endsAt: true, startsAt: true },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // If deal ended, don't generate
    if (new Date(deal.endsAt) < now) {
      return NextResponse.json(
        { error: "Deal is expired" },
        { status: 400 }
      );
    }

    // Try reuse: same deal + same deviceHash + not redeemed
    // (If you also store redeemedAt, keep this condition.)
    const existing = await prisma.redemption.findFirst({
      where: {
        dealId,
        deviceHash,
        redeemedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        shortCode: true,
        expiresAt: true, // may be null in your schema -> we handle it
        redeemedAt: true,
      },
    });

    if (existing?.shortCode) {
      const existingExpires =
        existing.expiresAt instanceof Date ? existing.expiresAt : null;

      // ✅ If expiresAt is null OR expired, refresh it so it always works
      if (!existingExpires || existingExpires <= now) {
        const updated = await prisma.redemption.update({
          where: { id: existing.id },
          data: { expiresAt: expiresAtNew },
          select: { shortCode: true, expiresAt: true },
        });

        return NextResponse.json({
          shortCode: updated.shortCode,
          expiresAt: updated.expiresAt!.toISOString(),
          reused: true,
          refreshed: true,
        });
      }

      // ✅ Safe: existingExpires is guaranteed non-null here
      return NextResponse.json({
        shortCode: existing.shortCode,
        expiresAt: existingExpires.toISOString(),
        reused: true,
        refreshed: false,
      });
    }

    // Create new redemption with unique shortCode
    let shortCode = randomCode(5);

    // retry a few times if collision
    for (let i = 0; i < 5; i++) {
      const collision = await prisma.redemption.findUnique({
        where: { shortCode },
        select: { id: true },
      });
      if (!collision) break;
      shortCode = randomCode(5);
    }

    const created = await prisma.redemption.create({
      data: {
        dealId,
        shortCode,
        code: crypto.randomUUID(), // ✅ required field
        deviceHash,
        expiresAt: expiresAtNew,
      },
      select: { shortCode: true, expiresAt: true },
    });

    return NextResponse.json({
      shortCode: created.shortCode,
      expiresAt: created.expiresAt!.toISOString(),
      reused: false,
    });
  } catch (e: any) {
    console.error("redeem/start error:", e);
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
