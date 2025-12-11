// app/api/deals/[id]/redemptions.csv/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ✅ Next 16–correct route signature
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Unwrap params (Next 16 requirement)
    const { id: dealIdRaw } = await context.params;
    const dealId = (dealIdRaw || "").trim();

    const url = new URL(request.url);
    const merchantId = url.searchParams.get("merchantId") || undefined;

    // Validate dealId
    if (!dealId || !UUID_RE.test(dealId)) {
      return new Response(`Invalid deal id: "${dealId}"`, { status: 400 });
    }

    // Fetch deal
    const { data: dealRows, error: dealErr } = await supabase
      .from("Deal")
      .select("id, title, shortCode, merchantId")
      .eq("id", dealId)
      .limit(1);

    if (dealErr) {
      return new Response(`Error fetching deal: ${dealErr.message}`, { status: 500 });
    }

    const deal = dealRows?.[0];
    if (!deal) {
      return new Response("Deal not found", { status: 404 });
    }

    // Optional merchant check
    if (merchantId && deal.merchantId !== merchantId) {
      return new Response("Deal does not belong to the provided merchant", { status: 403 });
    }

    // Fetch redemptions
    const { data: rows, error: rErr } = await supabase
      .from("Redemption")
      .select("id, code, createdAt")
      .eq("dealId", deal.id)
      .order("createdAt", { ascending: true });

    if (rErr) {
      return new Response(`Error fetching redemptions: ${rErr.message}`, { status: 500 });
    }

    // CSV header + body
    const header = [
      "redemption_id",
      "deal_id",
      "deal_short_code",
      "deal_title",
      "code",
      "created_at",
    ];

    const body = (rows ?? []).map((r) => [
      csvEscape(r.id),
      csvEscape(deal.id),
      csvEscape(deal.shortCode),
      csvEscape(deal.title),
      csvEscape(r.code),
      csvEscape(r.createdAt),
    ]);

    const csv =
      [header, ...body].map((row) => row.join(",")).join("\r\n") + "\r\n";

    const filename = `redemptions-${deal.shortCode || deal.id}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return new Response(err?.message || "Unexpected error", { status: 500 });
  }
}
