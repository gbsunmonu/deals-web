// app/api/merchant/redemptions/stream/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Helps some proxies (esp. Nginx) avoid buffering:
    "X-Accel-Buffering": "no",
  };
}

type RecentRedemptionRow = {
  id: string;
  redeemedAt: string | null;
  shortCode: string | null;
  deal: {
    id: string;
    title: string;
    discountType: string;
    discountValue: number;
    originalPrice: number | null;
  };
};

function toRow(r: any): RecentRedemptionRow {
  return {
    id: r.id,
    redeemedAt: r.redeemedAt ? r.redeemedAt.toISOString() : null,
    shortCode: r.shortCode ?? null,
    deal: {
      id: r.deal.id,
      title: r.deal.title,
      discountType: String(r.deal.discountType),
      discountValue: Number(r.deal.discountValue ?? 0),
      originalPrice: r.deal.originalPrice ?? null,
    },
  };
}

export async function GET(req: NextRequest) {
  // ✅ Merchant auth required
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ✅ Map Supabase user -> Merchant.id
  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!merchant) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since") || "";
  let since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60_000);
  if (Number.isNaN(since.getTime())) since = new Date(Date.now() - 60_000);

  let lastSentIso = since.toISOString();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));

      // initial hello
      send(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);

      const tick = async () => {
        try {
          // Pull anything newer than lastSentIso for this merchant
          const rows = await prisma.redemption.findMany({
            where: {
              redeemedAt: { not: null, gt: new Date(lastSentIso) },
              deal: { merchantId: merchant.id },
            },
            orderBy: { redeemedAt: "asc" },
            take: 50,
            select: {
              id: true,
              redeemedAt: true,
              shortCode: true,
              deal: {
                select: {
                  id: true,
                  title: true,
                  discountType: true,
                  discountValue: true,
                  originalPrice: true,
                },
              },
            },
          });

          if (rows.length) {
            const payload = rows.map(toRow);

            // update cursor to newest redeemedAt
            const newest = rows[rows.length - 1].redeemedAt!;
            lastSentIso = newest.toISOString();

            send(`event: redemption\ndata: ${JSON.stringify({ rows: payload })}\n\n`);
          } else {
            // keep-alive ping
            send(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
          }
        } catch (e: any) {
          send(
            `event: error\ndata: ${JSON.stringify({
              error: e?.message || "stream error",
            })}\n\n`
          );
        }
      };

      // ✅ SSE "push": server sends updates regularly (connection stays open)
      const interval = setInterval(tick, 2000);

      // fire immediately too
      tick();

      // cleanup on disconnect
      (controller as any).closeStream = () => clearInterval(interval);
    },

    cancel(reason) {
      // Called when client disconnects
      // @ts-ignore
      this.closeStream?.();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
