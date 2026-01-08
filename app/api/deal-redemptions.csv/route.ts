// app/api/deal-redemptions.csv/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_COOKIE, hashAdminPassword, safeEqual } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireAdmin(req: NextRequest) {
  const expectedPw = process.env.ADMIN_PASSWORD || "";
  if (!expectedPw) return false;

  const cookieVal = req.cookies.get(ADMIN_COOKIE)?.value || "";
  if (!cookieVal) return false;

  return safeEqual(cookieVal, hashAdminPassword(expectedPw));
}

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Parse YYYY-MM-DD (date only) or full ISO datetime.
// Returns an ISO string or null if value is empty.
function parseDateParam(v: string | null): string | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    // 00:00:00Z for date-only
    return `${trimmed}T00:00:00.000Z`;
  }

  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    // ✅ Admin-only
    if (!requireAdmin(req)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const raw = (url.searchParams.get("id") || url.searchParams.get("code") || "").trim();
    const merchantId = url.searchParams.get("merchantId") || undefined;

    const fromParam = url.searchParams.get("from"); // YYYY-MM-DD or ISO
    const toParam = url.searchParams.get("to");     // YYYY-MM-DD or ISO

    if (!raw) {
      return new Response('Missing ?id= (UUID) or ?code= (shortCode)', { status: 400 });
    }

    // Resolve dealId (UUID)
    let dealId: string | null = null;
    if (UUID_RE.test(raw)) {
      dealId = raw;
    } else {
      const { data: byCode, error: codeErr } = await supabase
        .from("Deal")
        .select("id")
        .eq("shortCode", raw)
        .maybeSingle();

      if (codeErr) return new Response(codeErr.message, { status: 500 });
      dealId = byCode?.id ?? null;
    }

    if (!dealId) {
      return new Response("Deal not found", { status: 404 });
    }

    // Parse date filters
    let fromISO: string | null = parseDateParam(fromParam);
    let toISO: string | null = parseDateParam(toParam);

    // If toParam was date-only, push to end of that day
    if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam.trim())) {
      const d = new Date(`${toParam.trim()}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCMilliseconds(d.getUTCMilliseconds() - 1);
      toISO = d.toISOString();
    }

    if (fromParam && !fromISO) return new Response(`Invalid 'from' date: "${fromParam}"`, { status: 400 });
    if (toParam && !toISO) return new Response(`Invalid 'to' date: "${toParam}"`, { status: 400 });

    // Load deal
    let dealQ = supabase
      .from("Deal")
      .select("id, shortCode, title, merchantId")
      .eq("id", dealId)
      .maybeSingle();

    const { data: deal, error: dealErr } = await dealQ;
    if (dealErr) return new Response(dealErr.message, { status: 500 });
    if (!deal) return new Response("Deal not found", { status: 404 });

    if (merchantId && deal.merchantId !== merchantId) {
      return new Response("Deal does not belong to merchantId", { status: 403 });
    }

    // Load redemptions
    let rQ = supabase
      .from("Redemption")
      .select("id, code, createdAt")
      .eq("dealId", dealId)
      .order("createdAt", { ascending: true });

    if (fromISO) rQ = rQ.gte("createdAt", fromISO);
    if (toISO) rQ = rQ.lte("createdAt", toISO);

    const { data: rows, error: rErr } = await rQ;
    if (rErr) return new Response(rErr.message, { status: 500 });

    const header = ["deal_id", "deal_short_code", "deal_title", "code", "created_at"];
    const body = (rows ?? []).map((r) => [
      csvEscape(deal.id),
      csvEscape(deal.shortCode),
      csvEscape(deal.title),
      csvEscape(r.code),
      csvEscape(r.createdAt),
    ]);

    const csv = [header, ...body].map((row) => row.join(",")).join("\r\n") + "\r\n";

    const rangeHint =
      fromParam || toParam ? `-${fromParam || "start"}_to_${toParam || "now"}` : "";
    const filename = `redemptions-${deal.shortCode || deal.id}${rangeHint}.csv`;

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
