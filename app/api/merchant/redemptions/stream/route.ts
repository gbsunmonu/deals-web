// app/api/merchant/redemptions/stream/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const POLL_MS = 2500; // how often we check DB for new redemptions
const KEEPALIVE_MS = 15000; // send keepalive ping to prevent proxies closing SSE

function sseFormat(event: string, data: any) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
  // ✅ Merchant auth
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ✅ Resolve merchantId via Merchant.userId
  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id as any },
    select: { id: true },
  });

  if (!merchant) {
    return new Response("Forbidden", { status: 403 });
  }

  const merchantId = merchant.id;

  // since cursor (ISO string)
  const sinceParam = req.nextUrl.searchParams.get("since") || "";
  const sinceDate = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60_000);

  // If invalid, fallback
  const since =
    Number.isNaN(sinceDate.getTime()) ? new Date(Date.now() - 60_000) : sinceDate;

  const encoder = new TextEncoder();

  let closed = false;
  let pollTimer: NodeJS.Timeout | null = null;
  let keepAliveTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // controller already closed
          closed = true;
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;

        if (pollTimer) clearInterval(pollTimer);
        if (keepAliveTimer) clearInterval(keepAliveTimer);

        pollTimer = null;
        keepAliveTimer = null;

        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      // ✅ If client disconnects / navigates away, stop timers immediately
      req.signal.addEventListener("abort", cleanup);

      // Initial hello (optional)
      send(sseFormat("hello", { ok: true }));

      // Keepalive ping so some proxies/browsers keep the connection open
      keepAliveTimer = setInterval(() => {
        send(`: ping ${Date.now()}\n\n`);
      }, KEEPALIVE_MS);

      // Poll DB for new redemptions and push over SSE
      let cursor = since;

      pollTimer = setInterval(async () => {
        if (closed) return;

        try {
          const rows = await prisma.redemption.findMany({
            where: {
              redeemedAt: { not: null, gt: cursor },
              deal: { merchantId },
            },
            orderBy: { redeemedAt: "asc" },
            take: 25,
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

          // advance cursor to newest redeemedAt in returned rows
          const newest = rows
            .map((r) => r.redeemedAt)
            .filter(Boolean)
            .sort((a, b) => a!.getTime() - b!.getTime())
            .pop();

          if (newest) cursor = newest;

          // Send to client
          send(
            sseFormat("redemption", {
              rows: rows.map((r) => ({
                id: r.id,
                redeemedAt: r.redeemedAt ? r.redeemedAt.toISOString() : null,
                shortCode: r.shortCode,
                deal: r.deal,
              })),
            })
          );
        } catch (e) {
          // If something goes wrong, end stream cleanly
          send(sseFormat("error", { message: "Stream error" }));
          cleanup();
        }
      }, POLL_MS);
    },

    cancel() {
      // ✅ Called when the consumer cancels the stream
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      pollTimer = null;
      keepAliveTimer = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Helps on some platforms
      "X-Accel-Buffering": "no",
    },
  });
}
