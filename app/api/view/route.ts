// app/api/view/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEVICE_COOKIE = "ytd_device";

function rand(len = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function clampId(s: unknown) {
  return String(s || "").trim();
}

function clampType(s: unknown) {
  const t = String(s || "").trim().toUpperCase();
  if (t === "DEAL_VIEW") return "DEAL_VIEW";
  if (t === "MERCHANT_PROFILE_VIEW") return "MERCHANT_PROFILE_VIEW";
  return null;
}

function dayStampUTC(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const type = clampType(body?.type);
    if (!type) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }

    const dealId = body?.dealId ? clampId(body.dealId) : null;
    const merchantId = body?.merchantId ? clampId(body.merchantId) : null;

    if (!dealId && !merchantId) {
      return NextResponse.json({ error: "missing_target" }, { status: 400 });
    }

    let deviceHash = req.cookies.get(DEVICE_COOKIE)?.value || "";
    if (!deviceHash) deviceHash = `d_${rand(32)}`;

    const now = new Date();
    const day = dayStampUTC(now);

    const target =
      type === "DEAL_VIEW"
        ? `deal:${dealId || "none"}`
        : `merchant:${merchantId || "none"}`;

    const dayKey = `${type}:${deviceHash}:${day}:${target}`.slice(0, 128);

    try {
      await prisma.event.create({
        data: {
          dayKey,
          deviceHash,
          type: type as any,
          dealId: dealId || null,
          merchantId: merchantId || null,
        },
        select: { id: true },
      });
    } catch (e: any) {
      if (e?.code !== "P2002") throw e;
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set(DEVICE_COOKIE, deviceHash, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });

    return res;
  } catch (e: any) {
    console.error("api/view error:", e);
    return NextResponse.json(
      { error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
