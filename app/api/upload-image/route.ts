// app/api/upload-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseRouteClient } from "@/lib/supabase-route";

// Explicitly use Node runtime
export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function safeExtFromMime(mime: string) {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Require merchant auth
    const supabase = await createSupabaseRouteClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: "Forbidden: merchant not found" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file found in form-data with key 'file'" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 5MB)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();

    // ✅ Crypto-safe filename (no Math.random)
    const ext = safeExtFromMime(file.type);
    const fileName = `deal-images/${merchant.id}/${Date.now()}-${crypto
      .randomBytes(16)
      .toString("hex")}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("deal-images")
      .upload(fileName, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("deal-images").getPublicUrl(fileName);

    return NextResponse.json({ publicUrl }, { status: 200 });
  } catch (err: any) {
    console.error("upload-image route error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown upload error" },
      { status: 500 }
    );
  }
}
