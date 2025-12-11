// actions/imageUpload.ts
'use server';

import { createSupabaseServer } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';

/**
 * Creates a signed upload URL for a deal image in the `deals` bucket.
 * You must have a public bucket called `deals` in Supabase Storage.
 */
export async function getDealUploadTarget(merchantId: string) {
  const supabase = createSupabaseServer();

  const objectName = `m_${merchantId}/${randomUUID()}.jpg`;

  const { data, error } = await supabase.storage
    .from('deals')
    .createSignedUploadUrl(objectName);

  if (error) {
    console.error('signed upload error', error);
    throw new Error('Could not create upload URL');
  }

  return {
    path: objectName,
    url: data.signedUrl,
    token: data.token,
  };
}
