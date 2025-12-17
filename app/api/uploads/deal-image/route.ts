import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseRouteClient } from "@/lib/supabase-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";

    const path = `merchants/${user.id}/${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.${safeExt}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("deal-images")
      .upload(path, Buffer.from(bytes), {
        contentType: file.type || "image/png",
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json(
        { error: "Upload failed", details: upErr.message },
        { status: 500 }
      );
    }

    const { data } = supabaseAdmin.storage.from("deal-images").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/uploads/deal-image] error:", err);
    return NextResponse.json(
      { error: "Upload failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
