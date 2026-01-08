// app/api/admin/merchants/route.ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ADMIN_COOKIE, hashAdminPassword, safeEqual } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;

  const expected = hashAdminPassword(pw);
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;

  return safeEqual(cookie, expected);
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAdmin(request)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") || "").toUpperCase();
  const q = (url.searchParams.get("q") || "").trim();

  const where: any = {};
  if (status && ["PENDING", "VERIFIED", "SUSPENDED"].includes(status)) {
    where.status = status;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }

  const merchants = await prisma.merchant.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      city: true,
      userId: true,
      createdAt: true,
      status: true,
      verifiedAt: true,
      statusReason: true,
      statusUpdatedAt: true,
    },
  });

  return new Response(JSON.stringify({ merchants }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isAdmin(request)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status.toUpperCase() : "";
  const reason = typeof body?.reason === "string" ? body.reason : null;

  if (!id) {
    return new Response(JSON.stringify({ error: "missing_id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!["PENDING", "VERIFIED", "SUSPENDED"].includes(status)) {
    return new Response(JSON.stringify({ error: "invalid_status" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const merchant = await prisma.merchant.update({
    where: { id },
    data: {
      status,
      statusReason: reason,
      statusUpdatedAt: new Date(),
      verifiedAt: status === "VERIFIED" ? new Date() : null,
    },
    select: {
      id: true,
      status: true,
      statusReason: true,
      statusUpdatedAt: true,
      verifiedAt: true,
    },
  });

  return new Response(JSON.stringify({ ok: true, merchant }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
