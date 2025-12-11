// app/api/uploads/deal-image/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const merchantId = (form.get("merchantId") as string) || "unknown";

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    const ext = (file.type?.split("/")[1] || "jpg").toLowerCase();
    const key = `merchants/${merchantId}/${Date.now()}-${randomUUID()}.${ext}`;

    const { error: upErr } = await supabaseAdmin
      .storage
      .from("deals")
      .upload(key, bytes, { contentType: file.type, upsert: false });

    if (upErr) throw upErr;

    const { data } = supabaseAdmin.storage.from("deals").getPublicUrl(key);
    return NextResponse.json({ url: data.publicUrl, path: key });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? "upload failed" }, { status: 500 });
  }
}
