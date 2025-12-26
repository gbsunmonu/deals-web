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
  if (!ip) return null;
  return sha256(ip);
}

const ALLOWED = new Set([
  "EXPLORE_VIEW",
  "EXPLORE_SEARCH",
  "DEAL_VIEW",
  "DEAL_REDEEM_CLICK",
  "DEAL_REDEEM_SUCCESS",
  "MERCHANT_PROFILE_VIEW",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const type = String(body?.type || "").trim().toUpperCase();
    if (!ALLOWED.has(type)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }

    const path = String(body?.path || "").slice(0, 300) || null;
    const dealId = body?.dealId ? String(body.dealId) : null;
    const merchantId = body?.merchantId ? String(body.merchantId) : null;
    const city = String(body?.city || "").slice(0, 120) || null;

    if (
      (type === "DEAL_VIEW" || type === "DEAL_REDEEM_CLICK" || type === "DEAL_REDEEM_SUCCESS") &&
      !dealId
    ) {
      return NextResponse.json({ error: "missing_dealId" }, { status: 400 });
    }
    if (type === "MERCHANT_PROFILE_VIEW" && !merchantId) {
      return NextResponse.json({ error: "missing_merchantId" }, { status: 400 });
    }

    // visitor cookie
    let vid = req.cookies.get(VISITOR_COOKIE)?.value || "";
    if (!vid || !isUuid(vid)) vid = randomUUID();

    // existing device cookie (optional)
    const deviceHash =
      String(req.cookies.get("ytd_device")?.value || "").slice(0, 80) || "unknown";

    const now = new Date();
    const day = dayStampUTC(now);

    const target =
      type.startsWith("DEAL_") || type === "DEAL_VIEW"
        ? `deal:${dealId || "none"}`
        : type === "MERCHANT_PROFILE_VIEW"
        ? `merchant:${merchantId || "none"}`
        : `path:${path || "none"}`;

    const dayKey = `${type}:${vid}:${day}:${target}`.slice(0, 128);

    const ua = req.headers.get("user-agent") || null;
    const ipHash = ipHashFromReq(req);

    // ✅ upsert VisitorProfile by id (cookie value == primary key)
    await prisma.visitorProfile.upsert({
      where: { id: vid },
      create: {
        id: vid,
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

    // ✅ create event (dedup by dayKey unique)
    try {
      await prisma.event.create({
        data: {
          dayKey,
          type: type as any,
          deviceHash,
          visitorId: vid, // nullable in schema is OK
          dealId,
          merchantId,
          city,
          userAgent: ua,
          ipHash,
        },
        select: { id: true },
      });
    } catch (e: any) {
      // ignore unique dayKey duplicates
      if (e?.code !== "P2002") throw e;
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set(VISITOR_COOKIE, vid, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365 * 2,
    });

    return res;
  } catch (e: any) {
    console.error("api/track error:", e);
    return NextResponse.json(
      { error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
