import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEVICE_COOKIE = "ytd_device";
const VISITOR_COOKIE = "ytd_vid";

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

function readCookie(req: NextRequest, name: string) {
  return req.cookies.get(name)?.value || "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const type = clampType(body?.type);
    if (!type) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

    const dealId = body?.dealId ? clampId(body.dealId) : null;
    const merchantId = body?.merchantId ? clampId(body.merchantId) : null;

    if (!dealId && !merchantId) {
      return NextResponse.json({ error: "missing_target" }, { status: 400 });
    }

    // device cookie (existing)
    let deviceHash = readCookie(req, DEVICE_COOKIE);
    if (!deviceHash) deviceHash = `d_${rand(32)}`;

    // ✅ visitorId cookie (set by middleware)
    const visitorId = readCookie(req, VISITOR_COOKIE);
    if (!visitorId) {
      // middleware should prevent this
      return NextResponse.json({ error: "missing_visitor" }, { status: 400 });
    }

    const now = new Date();
    const day = dayStampUTC(now);

    const target =
      type === "DEAL_VIEW"
        ? `deal:${dealId || "none"}`
        : `merchant:${merchantId || "none"}`;

    // ✅ dedupe per visitor/day/target/type
    const dayKey = `${type}:${visitorId}:${day}:${target}`.slice(0, 128);

    // ✅ Ensure visitor profile exists (upsert)
    await prisma.visitorProfile.upsert({
      where: { id: visitorId as any },
      create: {
        id: visitorId as any,
        deviceHash,
        lastSeenAt: now,
      },
      update: {
        deviceHash,
        lastSeenAt: now,
      },
      select: { id: true },
    });

    // insert once (unique dayKey)
    try {
      await prisma.event.create({
        data: {
          dayKey,
          deviceHash,
          visitorId: visitorId as any,
          type: type as any,
          dealId: dealId || null,
          merchantId: merchantId || null,
          userAgent: req.headers.get("user-agent") || null,
        },
        select: { id: true },
      });
    } catch (e: any) {
      if (e?.code !== "P2002") throw e; // ignore dup
    }

    const res = NextResponse.json({ ok: true });

    // keep device cookie (optional)
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
