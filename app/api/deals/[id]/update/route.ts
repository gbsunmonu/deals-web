// app/api/deals/[id]/update/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // Next.js 16: params is a Promise in route handlers
) {
  try {
    const { id } = await ctx.params;
    const form = await req.formData();

    const title = (form.get('title') ?? '').toString().trim();
    const description = (form.get('description') ?? '').toString().trim() || null;

    const startsAtStr = (form.get('startsAt') ?? '').toString();
    const endsAtStr = (form.get('endsAt') ?? '').toString();

    const maxRedemptionsStr = (form.get('maxRedemptions') ?? '').toString();
    const discountTypeRaw = (form.get('discountType') ?? '').toString().toUpperCase();
    const discountValueStr = (form.get('discountValue') ?? '').toString();
    const currency = (form.get('currency') ?? '').toString().trim() || 'NGN';
    const imageUrl = (form.get('imageUrl') ?? '').toString().trim() || null;

    const merchantId = (form.get('merchantId') ?? '').toString().trim();

    if (!title || !startsAtStr || !endsAtStr) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const startsAt = new Date(startsAtStr);
    const endsAt = new Date(endsAtStr);

    const maxRedemptions =
      maxRedemptionsStr !== '' ? Number(maxRedemptionsStr) : null;
    const discountValue =
      discountValueStr !== '' ? Number(discountValueStr) : null;

    const discountType =
      discountTypeRaw === 'PERCENT' || discountTypeRaw === 'AMOUNT'
        ? discountTypeRaw
        : null;

    await prisma.deal.update({
      where: { id },
      data: {
        title,
        description,
        startsAt,
        endsAt,
        maxRedemptions,
        discountType: discountType as any,
        discountValue: discountValue as any,
        currency,
        imageUrl,
      },
    });

    // Redirect back to dashboard
    const back = merchantId
      ? `/merchant/dashboard?merchantId=${encodeURIComponent(merchantId)}`
      : '/merchant/dashboard';

    return NextResponse.redirect(new URL(back, req.url));
  } catch (err) {
    console.error('Update deal failed:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
