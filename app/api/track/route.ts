// app/api/track/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureVisitorCookie } from "@/lib/visitor";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function dayStamp(d = new Date()) {
  // YYYY-MM-DD in UTC (stable)
  return d.toISOString().slice(0, 10);
}

function safeStr(v: unknown, max = 500) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function safeId(v: unknown) {
  const s = safeStr(v, 80);
  return s || null;
}

// we keep deviceHash because your Event model requires it
function deviceHashFromReq(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const al = req.headers.get("accept-language") || "";
  // simple stable hash (not PII stored raw)
  return sha256(`${ua}|${al}`).slice(0, 32);
}

export async function POST(req: NextRequest) {
  const now = new Date();

  const vid = await ensureVisitorCookie();

  const ua = req.headers.get("user-agent") || null;

  // Optional: hash IP if you want (behind proxies this can be tricky)
  // We'll keep it conservative: only hash if header exists.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  const ipHash = ip ? sha256(ip).slice(0, 32) : null;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // allow empty body
  }

  const type = safeStr(body?.type, 80);
  if (!type) {
    return NextResponse.json({ ok: false, error: "Missing type" }, { status: 400 });
  }

  const path = safeStr(body?.path, 300);
  const dealId = safeId(body?.dealId);
  const merchantId = safeId(body?.merchantId);
  const dedupe = Boolean(body?.dedupe);

  const meta =
    body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? body.meta
      : null;

  // ✅ daily dedupe key (unique)
  // visitor + date + type + target + path
  const keySeed = [
    dayStamp(now),
    vid,
    type,
    dealId || "",
    merchantId || "",
    path || "",
  ].join("|");

  const dayKey = sha256(keySeed).slice(0, 64);

  // ✅ upsert profile (VisitorProfile.id == visitor UUID)
  await prisma.visitorProfile.upsert({
    where: { id: vid as any },
    create: {
      id: vid as any,
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
  });

  const deviceHash = deviceHashFromReq(req);

  // ✅ create event (dedupe uses unique dayKey)
  try {
    await prisma.event.create({
      data: {
        type: type as any,
        deviceHash,
        dayKey,
        visitorId: vid as any,
        dealId: dealId as any,
        merchantId: merchantId as any,
        userAgent: ua,
        ipHash,
        ...(path ? { city: null } : {}),
      },
    });
  } catch (e: any) {
    // If dedupe enabled, ignore unique collisions for dayKey
    if (dedupe) {
      return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
    }
    // otherwise still don’t break user
    return NextResponse.json({ ok: true, warn: "event_insert_failed" }, { status: 200 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
