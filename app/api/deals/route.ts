// app/api/deals/route.ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

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

export async function GET(): Promise<Response> {
  const deals = await prisma.deal.findMany({
    where: { endsAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      discountValue: true,
      discountType: true,
      imageUrl: true,
      startsAt: true,
      endsAt: true,
      merchantId: true,
      merchant: { select: { id: true, name: true, city: true, whatsappNumber: true } },
    },
  });

  return new Response(JSON.stringify({ deals }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    const title = body?.title;
    const description = body?.description;
    const discountValueRaw = body?.discountValue;

    const startsAt = parseDate(body?.startsAt) ?? new Date();
    const endsAt =
      parseDate(body?.endsAt) ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const imageUrl = body?.imageUrl ? String(body.imageUrl).trim() : null;

    // ⚠️ This route seems like an internal/admin or legacy endpoint.
    // It expects merchantId from request body.
    const merchantId = body?.merchantId ? String(body.merchantId) : "";

    if (!merchantId) {
      return new Response(JSON.stringify({ error: "missing_merchantId" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const discountValueParsed = toInt(discountValueRaw) ?? 0;
    const discountValue = clamp(discountValueParsed, 0, 100);

    // ✅ REQUIRED BY PRISMA SCHEMA
    const discountType: "PERCENT" | "NONE" =
      discountValue > 0 ? "PERCENT" : "NONE";

    const deal = await prisma.deal.create({
      data: {
        title,
        description,
        discountValue,
        discountType,
        startsAt,
        endsAt,
        imageUrl,
        merchantId,
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
    console.error("/api/deals POST error:", e);
    return new Response(
      JSON.stringify({ error: "server_error", message: e?.message ?? String(e) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
