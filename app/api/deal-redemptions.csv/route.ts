// app/api/deal-redemptions.csv/route.ts
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Parse YYYY-MM-DD (date only) or full ISO datetime.
// Returns an ISO string or null if value is empty.
function parseDateParam(v: string | null): string | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;

  // If it's a date-only like 2025-11-01, convert to start/end of day in UTC where needed.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    // For "from", caller will pass as-is (00:00:00Z). For "to", caller should pass +1 day minus epsilon.
    // We'll handle "to" below by detecting if time is missing and pushing to end-of-day.
    // For now return 00:00:00Z and let caller decide.
    return new Date(trimmed + 'T00:00:00Z').toISOString();
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = (url.searchParams.get('id') || url.searchParams.get('code') || '').trim();
    const merchantId = url.searchParams.get('merchantId') || undefined;

    // New params
    const fromParam = url.searchParams.get('from'); // accepts YYYY-MM-DD or ISO
    const toParam = url.searchParams.get('to');     // accepts YYYY-MM-DD or ISO

    if (!raw) {
      return new Response('Missing ?id= (UUID) or ?code= (shortCode)', { status: 400 });
    }

    // Resolve dealId (UUID)
    let dealId: string | null = null;
    if (UUID_RE.test(raw)) {
      dealId = raw;
    } else {
      const { data: byCode, error: codeErr } = await supabase
        .from('Deal')
        .select('id')
        .eq('shortCode', raw)
        .limit(1);
      if (codeErr) return new Response(`Error resolving code: ${codeErr.message}`, { status: 500 });
      dealId = byCode?.[0]?.id ?? null;
    }

    if (!dealId) return new Response(`No deal found for "${raw}"`, { status: 404 });

    // Load the deal (and optionally verify merchant)
    const { data: dealRows, error: dealErr } = await supabase
      .from('Deal')
      .select('id, title, shortCode, merchantId')
      .eq('id', dealId)
      .limit(1);
    if (dealErr) return new Response(`Error fetching deal: ${dealErr.message}`, { status: 500 });

    const deal = dealRows?.[0];
    if (!deal) return new Response('Deal not found', { status: 404 });
    if (merchantId && deal.merchantId !== merchantId) {
      return new Response('Deal does not belong to the provided merchant', { status: 403 });
    }

    // ----- Date range handling -----
    let fromISO = parseDateParam(fromParam);
    let toISO = parseDateParam(toParam);

    // If user passed a date-only for "to", bump to end-of-day (exclusive upper bound):
    // e.g., 2025-11-01 -> 2025-11-01T23:59:59.999Z (approx; we'll convert by adding 1 day at 00:00Z and treat as < next day)
    if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      const d = new Date(toParam + 'T00:00:00Z');
      if (!isNaN(d.getTime())) {
        d.setUTCDate(d.getUTCDate() + 1); // next day 00:00Z
        toISO = d.toISOString();
      }
    }

    // If "from" or "to" were provided but invalid, return error
    if (fromParam && !fromISO) {
      return new Response(`Invalid 'from' date: "${fromParam}"`, { status: 400 });
    }
    if (toParam && !toISO) {
      return new Response(`Invalid 'to' date: "${toParam}"`, { status: 400 });
    }

    // Build query
    let q = supabase
      .from('Redemption')
      .select('id, code, createdAt')
      .eq('dealId', deal.id);

    if (fromISO) q = q.gte('createdAt', fromISO);
    if (toISO)   q = q.lt('createdAt', toISO); // exclusive upper bound

    // Default order oldest first for CSV
    q = q.order('createdAt', { ascending: true });

    const { data: rows, error: rErr } = await q;
    if (rErr) return new Response(`Error fetching redemptions: ${rErr.message}`, { status: 500 });

    // CSV
    const header = [
      'redemption_id',
      'deal_id',
      'deal_short_code',
      'deal_title',
      'code',
      'created_at',
    ];
    const body = (rows ?? []).map((r) => [
      csvEscape(r.id),
      csvEscape(deal.id),
      csvEscape(deal.shortCode),
      csvEscape(deal.title),
      csvEscape(r.code),
      csvEscape(r.createdAt),
    ]);
    const csv = [header, ...body].map((row) => row.join(',')).join('\r\n') + '\r\n';

    // Filename with optional range hint
    const rangeHint =
      fromParam || toParam
        ? `-${fromParam || 'start'}_to_${toParam || 'now'}`
        : '';
    const filename = `redemptions-${deal.shortCode || deal.id}${rangeHint}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return new Response(err?.message || 'Unexpected error', { status: 500 });
  }
}
