"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export async function repostDealAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "").trim();
  if (!dealId) redirect("/merchant/deals?err=missing_deal");

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/merchant/deals");

  // resolve merchant for this user
  const merchant = await prisma.merchant.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!merchant) redirect("/merchant/deals?err=no_merchant");

  // fetch deal and ensure ownership
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, merchantId: merchant.id },
  });

  if (!deal) redirect("/merchant/deals?err=not_found");

  const now = new Date();
  const expired = deal.endsAt < now;
  if (!expired) redirect("/merchant/deals?err=not_expired");

  // preserve original duration (fallback 7 days)
  const durationMs = deal.endsAt.getTime() - deal.startsAt.getTime();
  const durationDays = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)) || 7);

  const newStartsAt = now;
  const newEndsAt = addDays(now, durationDays);

  const newDeal = await prisma.deal.create({
    data: {
      merchantId: deal.merchantId,

      title: deal.title,
      description: deal.description,

      originalPrice: deal.originalPrice,

      // ✅ IMPORTANT: shortCode is unique — reset it
      shortCode: null,

      discountValue: deal.discountValue as any,
      discountType: deal.discountType,

      imageUrl: deal.imageUrl,
      maxRedemptions: deal.maxRedemptions,

      startsAt: newStartsAt,
      endsAt: newEndsAt,

      // ✅ link back
      repostedFromId: deal.id,
    },
    select: { id: true },
  });

  // take merchant to the newly created deal edit/details page
  redirect(`/merchant/deals?reposted=${newDeal.id}`);
}
