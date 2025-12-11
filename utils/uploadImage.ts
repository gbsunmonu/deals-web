// deals-web/utils/uploadImage.ts
"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Upload an image file to a Supabase Storage bucket and return its public URL.
 *
 * @param file   The File object from an <input type="file" />
 * @param bucket The storage bucket name (e.g. "deal-images" or "merchant-avatars")
 */
export async function uploadImage(
  file: File,
  bucket: string
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1) Make sure user is logged in
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Supabase auth error:", authError);
    throw new Error("Failed to get current user");
  }
  if (!user) {
    throw new Error("Not authenticated");
  }

  // 2) Generate a unique file path
  const ext = file.name.split(".").pop() || "png";
  const filePath = `user-${user.id}/${Date.now()}.${ext}`;

  // 3) Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    console.error("Supabase upload error:", uploadError);
    throw new Error(uploadError.message || "Failed to upload image");
  }

  // 4) Get a public URL for the uploaded file
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error("Could not get public URL for uploaded image");
  }

  return data.publicUrl;
}
