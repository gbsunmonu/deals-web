import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomUUID, createHash } from "crypto";
import { VISITOR_COOKIE } from "@/lib/visitor";

export const dynamic = "force-dynamic";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function dayStampUTC(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ipHashFromReq(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  return ip ? sha256(ip) : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const rawType = String(body?.type || "").trim();
    const type = (rawType || "EXPLORE_VIEW").toUpperCase();

    const dealId = body?.dealId ? String(body.dealId) : null;
    const merchantId = body?.merchantId ? String(body.merchantId) : null;

    const path =
      (body?.path ? String(body.path) : null) ||
      req.headers.get("referer") ||
      null;

    const city = body?.city ? String(body.city) : null;

    // visitor cookie (anonymous persistent id)
    let visitorId = req.cookies.get(VISITOR_COOKIE)?.value || "";
    if (!visitorId || !isUuid(visitorId)) visitorId = randomUUID();

    // optional device cookie you already use
    const deviceHash =
      String(req.cookies.get("ytd_device")?.value || "").slice(0, 80) ||
      "unknown";

    const now = new Date();
    const day = dayStampUTC(now);

    // dedupe per visitor/day/type/target
    const target = dealId
      ? `deal:${dealId}`
      : merchantId
      ? `merchant:${merchantId}`
      : "none";

    const dayKey = `${type}:${visitorId}:${day}:${target}`.slice(0, 128);

    const ua = req.headers.get("user-agent") || null;
    const ipHash = ipHashFromReq(req);

    // upsert visitor profile
    await prisma.visitorProfile.upsert({
      where: { id: visitorId },
      create: {
        id: visitorId,
        firstSeenAt: now,
        lastSeenAt: now,
        lastPath: path,
        userAgent: ua,
        ipHash,
      },
      update: {
        lastSeenAt: now,
        lastPath: path,
        userAgent: ua,
        ipHash,
      },
      select: { id: true },
    });

    // create event (ignore duplicates on dayKey)
    try {
      await prisma.event.create({
        data: {
          type: type as any,
          deviceHash,
          dayKey,
          visitorId,
          dealId,
          merchantId,
          city: city ?? null,
          userAgent: ua,
          ipHash,
        },
        select: { id: true },
      });
    } catch (e: any) {
      if (e?.code !== "P2002") throw e;
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set(VISITOR_COOKIE, visitorId, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365 * 2,
    });

    return res;
  } catch (e: any) {
    console.error("/api/track error:", e);
    return NextResponse.json(
      { error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
