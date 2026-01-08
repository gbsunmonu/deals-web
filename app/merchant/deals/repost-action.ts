"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

function randomCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function uniqueShortCode(): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode(6);
    const exists = await prisma.deal.findFirst({
      where: { shortCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  return null;
}

export async function repostDealAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "").trim();
  if (!dealId) redirect("/merchant/deals?err=missing_dealId");

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/sign-in?next=/merchant/deals");

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!merchant) redirect("/merchant/profile?err=no_merchant");

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, merchantId: merchant.id },
  });

  if (!deal) redirect("/merchant/deals?err=deal_not_found");

  const now = new Date();
  if (deal.endsAt >= now) {
    redirect("/merchant/deals?err=deal_not_expired");
  }

  // Keep same duration (fallback 30 days)
  const durationMs = deal.endsAt.getTime() - deal.startsAt.getTime();
  const safeDurationMs =
    Number.isFinite(durationMs) && durationMs > 60_000
      ? durationMs
      : 30 * 24 * 60 * 60 * 1000;

  const newStartsAt = now;
  const newEndsAt = new Date(now.getTime() + safeDurationMs);

  const shortCode = await uniqueShortCode();

  const newDeal = await prisma.deal.create({
    data: {
      merchantId: merchant.id,
      title: deal.title,
      description: deal.description,
      originalPrice: deal.originalPrice,
      discountValue: deal.discountValue,
      discountType: deal.discountType,
      imageUrl: deal.imageUrl,
      maxRedemptions: deal.maxRedemptions,
      startsAt: newStartsAt,
      endsAt: newEndsAt,
      repostedFromId: deal.id,
      shortCode, // ok if null
    },
    select: { id: true },
  });

  redirect(`/merchant/deals?reposted=${newDeal.id}`);
}
