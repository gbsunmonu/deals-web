// app/api/merchant/redemptions/stream/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StreamRow = {
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

function sseEvent(event: string, data: any) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  // ✅ Merchant auth
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id as any },
    select: { id: true, name: true },
  });

  if (!merchant) {
    return NextResponse.json({ error: "not_a_merchant" }, { status: 403 });
  }

  const encoder = new TextEncoder();

  // Start “cursor” from now so we only stream NEW redemptions
  let lastSent = new Date();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (txt: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(txt));
        } catch {
          // Controller already closed
          closed = true;
        }
      };

      // immediately tell client stream is ready
      send(sseEvent("ready", { ok: true, merchantId: merchant.id }));

      // keepalive ping so proxies don’t kill the connection
      const ping = setInterval(() => {
        send(`event: ping\ndata: ${Date.now()}\n\n`);
      }, 15000);

      // poll DB for new redemptions
      const poll = setInterval(async () => {
        if (closed) return;

        try {
          const rows = await prisma.redemption.findMany({
            where: {
              redeemedAt: { not: null, gt: lastSent },
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

          if (!rows.length) return;

          // advance cursor
          const newest = rows[rows.length - 1].redeemedAt!;
          lastSent = new Date(newest);

          // push each row
          for (const r of rows) {
            const payload: StreamRow = {
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

            send(sseEvent("redemption", payload));
          }
        } catch (e) {
          // don’t crash stream
          send(sseEvent("error", { error: "poll_failed" }));
        }
      }, 500);

      // cleanup on close
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        clearInterval(poll);
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      // If client disconnects, Next/Node will typically tear it down.
      // This keeps us safe even if it doesn’t:
      (globalThis as any).__ytd_cleanup = cleanup;
    },
    cancel() {
      // close intervals when client disconnects
      try {
        const fn = (globalThis as any).__ytd_cleanup;
        if (typeof fn === "function") fn();
      } catch {
        // ignore
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
