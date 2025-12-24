// app/actions/createDeal.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { redirect } from "next/navigation";

type CreateDealInput = {
  title: string;
  description: string;
  originalPrice?: number | null;
  discountType?: "NONE" | "PERCENT";
  discountValue?: number;
  imageUrl?: string | null;
  maxRedemptions?: number | null;
  startsAt: string; // ISO string
  endsAt: string; // ISO string
};

export async function createDeal(input: CreateDealInput) {
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?returnTo=/merchant/profile");

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id as any },
    select: { id: true },
  });

  if (!merchant) redirect("/merchant/profile");

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  const discountType = (input.discountType ?? "NONE") as any;
  const discountValue = Number(input.discountValue ?? 0);

  const created = await prisma.deal.create({
    data: {
      merchantId: merchant.id,
      title: String(input.title || "").trim(),
      description: String(input.description || "").trim(),
      originalPrice:
        input.originalPrice == null ? null : Math.max(0, Math.round(input.originalPrice)),
      discountType,
      discountValue: Math.max(0, Math.round(discountValue)),
      imageUrl: input.imageUrl ?? null,
      maxRedemptions:
        input.maxRedemptions == null ? null : Math.max(0, Math.round(input.maxRedemptions)),
      startsAt,
      endsAt,
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}
