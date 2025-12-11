import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { merchantId, merchantPin, status, start, end, page = 1, pageSize = 20 } = await req.json();
    if (!merchantId || !merchantPin) return NextResponse.json({ error: "Auth required" }, { status: 400 });

    // auth
    const { data: merchant } = await admin
      .from("merchants")
      .select("id, merchant_pin")
      .eq("id", merchantId)
      .single();
    if (!merchant || merchant.merchant_pin !== merchantPin) return NextResponse.json({ error: "Invalid merchant PIN" }, { status: 401 });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = admin
      .from("redemptions")
      .select("id, short_code, status, created_at, redeemed_at, deal_id", { count: "exact" })
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) q = q.eq("status", status);
    if (start) q = q.gte("created_at", new Date(start).toISOString());
    if (end) q = q.lte("created_at", new Date(end).toISOString());

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
