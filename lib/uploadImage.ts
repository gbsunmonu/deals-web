// lib/uploadImage.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // needs service role for upload
const bucketName = 'deal-images'; // <- use your real bucket name

const supabase = createClient(supabaseUrl, supabaseKey);

export async function uploadImageToSupabase(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const filePath = `deals/${fileName}`;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: file.type || 'image/png',
      upsert: false,
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error('Failed to upload image to storage');
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucketName).getPublicUrl(filePath);

  return publicUrl;
}
