// deals-web/app/api/merchant/logo/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer(); // ✅ IMPORTANT

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[POST /api/merchant/logo] auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ...rest of your logic
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/merchant/logo] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
