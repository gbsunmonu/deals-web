// app/api/uploads/deal-image/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from("deal-images")
      .upload(fileName, buffer, {
        contentType: file.type,
      });

    if (error) {
      console.error("Upload error:", error);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/deal-images/${data.path}`;

    return NextResponse.json(
      { url: publicUrl },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Upload route error:", err);
    return NextResponse.json(
      { error: err.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}
