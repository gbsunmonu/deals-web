import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { merchantId, merchantPin } = await req.json();
    if (!merchantId || !merchantPin) {
      return NextResponse.json({ error: "merchantId and merchantPin required" }, { status: 400 });
    }

    // 1) Auth merchant
    const { data: merchant, error: mErr } = await admin
      .from("merchants")
      .select("id, merchant_pin, business_name")
      .eq("id", merchantId)
      .single();

    if (mErr || !merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    if (merchant.merchant_pin !== merchantPin) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    // 2) Compute “today” in UTC (simpler); adjust if you store local TZ
    const start = new Date(); start.setUTCHours(0,0,0,0);
    const end = new Date();   end.setUTCHours(23,59,59,999);

    // Today redeemed count
    const { count: todayRedeemed } = await admin
      .from("redemptions")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("status", "redeemed")
      .gte("redeemed_at", start.toISOString())
      .lte("redeemed_at", end.toISOString());

    // Total redeemed (lifetime)
    const { count: totalRedeemed } = await admin
      .from("redemptions")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("status", "redeemed");

    // Recent 20 redemptions
    const { data: recent } = await admin
      .from("redemptions")
      .select("id, short_code, status, created_at, redeemed_at, deal_id")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Deals (basic)
    const { data: deals } = await admin
      .from("deals")
      .select("id, title, status")
      .eq("merchant_id", merchantId)
      .order("title");

    return NextResponse.json({
      merchant: { id: merchant.id, name: merchant.business_name },
      metrics: {
        todayRedeemed: todayRedeemed ?? 0,
        totalRedeemed: totalRedeemed ?? 0,
      },
      recent: recent ?? [],
      deals: deals ?? [],
    });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
