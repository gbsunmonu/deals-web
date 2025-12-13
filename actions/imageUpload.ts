// deals-web/actions/imageUpload.ts
"use server";

import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function createImageUploadUrl(merchantId: string) {
  const supabase = await createSupabaseServer(); // ✅ FIX

  const objectName = `m_${merchantId}/${randomUUID()}.jpg`;

  const { data, error } = await supabase.storage
    .from("deals")
    .createSignedUploadUrl(objectName);

  if (error) throw new Error(error.message);

  return { objectName, ...data };
}
