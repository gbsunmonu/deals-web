// app/api/admin/merchants/[id]/status/route.ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ADMIN_COOKIE, hashAdminPassword, safeEqual } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

type MerchantStatus = "PENDING" | "VERIFIED" | "SUSPENDED";

function isAdmin(req: NextRequest): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;

  const expected = hashAdminPassword(pw);
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;

  return safeEqual(cookie, expected);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isAdmin(request)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { id } = await context.params;
  if (!id) {
    return new Response(JSON.stringify({ error: "missing_id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const status = String(body?.status || "").toUpperCase() as MerchantStatus;
  const reason = typeof body?.reason === "string" ? body.reason : null;

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
