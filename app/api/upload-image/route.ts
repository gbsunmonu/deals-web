// app/api/upload-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Explicitly use Node runtime
export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file found in form-data with key 'file'" },
        { status: 400 }
      );
    }

    // Use only ArrayBuffer – NO Buffer
    const bytes = await file.arrayBuffer();

    const ext = file.name.split(".").pop() || "png";
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("deal-images") // 👈 bucket name
      .upload(fileName, bytes, {
        contentType: file.type || "image/png",
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("deal-images").getPublicUrl(fileName);

    return NextResponse.json({ publicUrl }, { status: 200 });
  } catch (err: any) {
    console.error("upload-image route error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown upload error" },
      { status: 500 }
    );
  }
}
