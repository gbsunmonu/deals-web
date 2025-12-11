// actions/merchantProfile.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getMerchantId } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export async function updateMerchantProfile(formData: FormData) {
  try {
    const merchantId = await getMerchantId();
    if (!merchantId) {
      console.error('No merchantId from getMerchantId()');
      return { ok: false, error: 'Not signed in as a merchant.' };
    }

    const name = (formData.get('name') || '').toString().trim();
    const address = (formData.get('address') || '').toString().trim();
    const city = (formData.get('city') || '').toString().trim();
    const phone = (formData.get('phone') || '').toString().trim();
    const website = (formData.get('website') || '').toString().trim();
    const mapUrl = (formData.get('mapUrl') || '').toString().trim();
    const description = (formData.get('description') || '').toString().trim();

    // Build update object but only include fields that are not empty
    const data: any = {
      name: name || undefined,
      address: address || undefined,
      city: city || undefined,
      phone: phone || undefined,
      website: website || undefined,
      mapUrl: mapUrl || undefined,
      description: description || undefined,
    };

    await prisma.merchant.update({
      where: { id: merchantId },
      data,
    });

    // Make sure dashboard/profile re-fetch recent data
    revalidatePath('/merchant/profile');
    revalidatePath('/merchant/dashboard');

    return { ok: true };
  } catch (err) {
    console.error('Error updating merchant profile', err);
    return { ok: false, error: 'Database error saving profile.' };
  }
}
