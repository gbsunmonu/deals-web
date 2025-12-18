import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AvailabilityRow = {
  id: string;
  redeemedCount: number;
  left: number | null;
  soldOut: boolean;
  maxRedemptions: number | null;
};

async function computeAvailability(ids: string[]): Promise<Record<string, AvailabilityRow>> {
  if (!ids.length) return {};

  // fetch maxRedemptions for deals
  const deals = await prisma.deal.findMany({
    where: { id: { in: ids } },
    select: { id: true, maxRedemptions: true },
  });

  // count redeemed per deal (redeemedAt NOT NULL)
  const redeemed = await prisma.redemption.groupBy({
    by: ["dealId"],
    where: { dealId: { in: ids }, redeemedAt: { not: null } },
    _count: { _all: true },
  });

  const redeemedMap = new Map<string, number>();
  for (const r of redeemed) redeemedMap.set(r.dealId, r._count._all);

  const out: Record<string, AvailabilityRow> = {};
  for (const d of deals) {
    const max = d.maxRedemptions ?? null;
    const redeemedCount = redeemedMap.get(d.id) ?? 0;

    const unlimited = max == null || max <= 0;
    const left = unlimited ? null : Math.max(0, max - redeemedCount);
    const soldOut = unlimited ? false : redeemedCount >= max;

    out[d.id] = {
      id: d.id,
      redeemedCount,
      left,
      soldOut,
      maxRedemptions: max,
    };
  }

  return out;
}

function sse(data: any, event?: string) {
  const lines = [];
  if (event) lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push("");
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const encoder = new TextEncoder();

  let closed = false;
  let last: Record<string, AvailabilityRow> = {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // immediately send a hello + initial data
      (async () => {
        try {
          controller.enqueue(encoder.encode(sse({ ok: true }, "hello")));

          const initial = await computeAvailability(ids);
          last = initial;
          controller.enqueue(encoder.encode(sse({ map: initial }, "availability")));

          // heartbeat keeps proxies happy
          const heartbeat = setInterval(() => {
            if (closed) return;
            controller.enqueue(encoder.encode(`: ping\n\n`));
          }, 15000);

          // push updates every 2s (server-side polling; client no longer polls)
          const tick = setInterval(async () => {
            if (closed) return;
            try {
              const next = await computeAvailability(ids);

              // only send if something changed
              const changed: Record<string, AvailabilityRow> = {};
              let any = false;

              for (const id of ids) {
                const a = last[id];
                const b = next[id];
                if (!b) continue;

                const diff =
                  !a ||
                  a.soldOut !== b.soldOut ||
                  (a.left ?? null) !== (b.left ?? null) ||
                  (a.redeemedCount ?? 0) !== (b.redeemedCount ?? 0) ||
                  (a.maxRedemptions ?? null) !== (b.maxRedemptions ?? null);

                if (diff) {
                  changed[id] = b;
                  any = true;
                }
              }

              if (any) {
                // merge
                last = { ...last, ...next };
                controller.enqueue(encoder.encode(sse({ map: changed }, "availability")));
              }
            } catch (e: any) {
              controller.enqueue(encoder.encode(sse({ ok: false, error: e?.message || "stream error" }, "error")));
            }
          }, 2000);

          const cleanup = () => {
            if (closed) return;
            closed = true;
            clearInterval(heartbeat);
            clearInterval(tick);
            try {
              controller.close();
            } catch {}
          };

          // close when client disconnects
          req.signal.addEventListener("abort", cleanup);
        } catch (e: any) {
          controller.enqueue(encoder.encode(sse({ ok: false, error: e?.message || "init error" }, "error")));
          controller.close();
        }
      })();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // helps on some proxies
    },
  });
}
