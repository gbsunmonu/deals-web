// app/api/deals/create/route.ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function parseDate(v: any) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toInt(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Verify merchant auth via Supabase (server-side)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false },
    });

    const accessToken =
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      request.cookies.get("sb-access-token")?.value ||
      "";

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const { data: userRes, error: userErr } = await supabase.auth.getUser(
      accessToken
    );

    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const user = userRes.user;

    // Find merchant linked to this user
    const merchant = await prisma.merchant.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!merchant) {
      return new Response(JSON.stringify({ error: "merchant_not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const body = await request.json().catch(() => ({}));

    const title = String(body?.title ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const imageUrl = body?.imageUrl ? String(body.imageUrl).trim() : null;

    const originalPriceRaw = body?.originalPrice ?? null;
    const discountValueRaw = body?.discountValue ?? 0;

    const startsAt = parseDate(body?.startsAt) ?? new Date();
    const endsAt =
      parseDate(body?.endsAt) ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (!title || title.length < 3) {
      return new Response(JSON.stringify({ error: "invalid_title" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!description || description.length < 5) {
      return new Response(JSON.stringify({ error: "invalid_description" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // sanitize sizes
    const safeDescription = description.slice(0, 2000);
    const numericOriginal =
      originalPriceRaw === null ? null : toInt(originalPriceRaw);

    const discountValueParsed = toInt(discountValueRaw) ?? 0;
    const discountValue = clamp(discountValueParsed, 0, 100);

    // ✅ REQUIRED BY PRISMA SCHEMA
    // If discountValue is > 0, treat as percent discount.
    // If 0, there is no discount.
    const discountType: "PERCENT" | "NONE" =
      discountValue > 0 ? "PERCENT" : "NONE";

    if (endsAt <= startsAt) {
      return new Response(JSON.stringify({ error: "invalid_date_range" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const deal = await prisma.deal.create({
      data: {
        title,
        description: safeDescription,
        originalPrice: numericOriginal,
        discountValue,
        discountType,
        startsAt,
        endsAt,
        imageUrl,
        merchantId: merchant.id,
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        merchantId: true,
      },
    });

    return new Response(JSON.stringify({ ok: true, deal }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    console.error("/api/deals/create error:", e);
    return new Response(
      JSON.stringify({ error: "server_error", message: e?.message ?? String(e) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
