import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEVICE_COOKIE = "ytd_device";

function rand(len = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function startOfDayISO(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // Use YYYY-MM-DD in local time for "dayKey"
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clampUuid(s: any) {
  const v = String(s || "").trim();
  // basic UUID check (avoid junk)
  if (!/^[0-9a-fA-F-]{20,40}$/.test(v)) return null;
  return v;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const type = String(body?.type || "");
    if (type !== "DEAL_VIEW" && type !== "MERCHANT_PROFILE_VIEW") {
      return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
    }

    const merchantId = clampUuid(body?.merchantId);
    const dealId = body?.dealId ? clampUuid(body?.dealId) : null;

    if (!merchantId) {
      return NextResponse.json({ ok: false, error: "missing_merchantId" }, { status: 400 });
    }

    if (type === "DEAL_VIEW" && !dealId) {
      return NextResponse.json({ ok: false, error: "missing_dealId" }, { status: 400 });
    }

    // device cookie
    let deviceHash = req.cookies.get(DEVICE_COOKIE)?.value || "";
    if (!deviceHash) deviceHash = `d_${rand(32)}`;

    const today = startOfDayISO(new Date());

    // ✅ dayKey dedupe rules:
    // - DEAL_VIEW: one per device per day per deal
    // - MERCHANT_PROFILE_VIEW: one per device per day per merchant
    const dayKey =
      type === "DEAL_VIEW"
        ? `dv:${today}:${deviceHash}:${dealId}`
        : `mpv:${today}:${deviceHash}:${merchantId}`;

    // Insert if not exists (dayKey is unique in schema)
    try {
      await prisma.event.create({
        data: {
          type: type as any,
          deviceHash,
          dayKey,
          merchantId,
          dealId: type === "DEAL_VIEW" ? dealId : null,
        },
        select: { id: true },
      });
    } catch (e: any) {
      // If duplicate dayKey => ignore (already viewed today)
      // Prisma error code for unique violation is P2002
      if (e?.code !== "P2002") {
        // ignore other errors too (views must not break UX)
      }
    }

    const res = NextResponse.json({ ok: true });

    // persist device cookie
    res.cookies.set(DEVICE_COOKIE, deviceHash, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
