'use server';

import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

// tiny helper to make a 5-char short code (A–Z0–9)
function makeShortCode(len = 5) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function createDeal(formData: FormData) {
  // Required
  const merchantId = String(formData.get('merchantId') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const startsAtStr = String(formData.get('startsAt') || '').trim();
  const endsAtStr = String(formData.get('endsAt') || '').trim();

  if (!merchantId) throw new Error('Missing merchantId');
  if (!title) throw new Error('Title is required');
  if (!startsAtStr || !endsAtStr) throw new Error('Start and end date/times are required');

  // Optional
  const description = (formData.get('description') as string) || null;
  const terms = (formData.get('terms') as string) || null;
  const imageUrl = (formData.get('imageUrl') as string) || null;
  const currency = (formData.get('currency') as string) || 'NGN';
  const city = ((formData.get('city') as string) || '').trim() || null;
  const category = ((formData.get('category') as string) || '').trim() || null;

  const discountTypeRaw = (formData.get('discountType') as string) || null; // 'PERCENT' | 'AMOUNT' | null
  const discountValueRaw = (formData.get('discountValue') as string) || '';
  const maxRedemptionsRaw = (formData.get('maxRedemptions') as string) || '';

  const discountType = discountTypeRaw ? (discountTypeRaw as 'PERCENT' | 'AMOUNT') : null;
  const discountValue =
    discountValueRaw !== '' && !Number.isNaN(Number(discountValueRaw))
      ? Number(discountValueRaw)
      : null;

  const maxRedemptions =
    maxRedemptionsRaw !== '' && !Number.isNaN(Number(maxRedemptionsRaw))
      ? Number(maxRedemptionsRaw)
      : null;

  // Parse dates
  const startsAt = new Date(startsAtStr);
  const endsAt = new Date(endsAtStr);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error('Invalid date(s)');
  }

  // Ensure unique-ish short code
  let shortCode = makeShortCode();
  // try a couple of times to avoid unique collision
  // (Prisma unique constraint will still protect you)
  for (let i = 0; i < 3; i++) {
    const exists = await prisma.deal.findUnique({ where: { shortCode } });
    if (!exists) break;
    shortCode = makeShortCode();
  }

  await prisma.deal.create({
    data: {
      merchantId,
      title,
      description,
      shortCode,
      startsAt,
      endsAt,
      maxRedemptions,
      terms,
      discountType,
      discountValue,
      imageUrl,
      currency,
      city,
      category,
    },
  });

  redirect('/merchant/dashboard');
}
