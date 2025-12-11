// app/actions/createDeal.ts
"use server";

import { prisma } from "@/lib/prisma";
import { DiscountType } from "@prisma/client";
import { getMerchantId } from "@/lib/session";

export async function createDeal(formData: FormData) {
  const merchantId = await getMerchantId();
  if (!merchantId) {
    throw new Error("Not logged in as merchant");
  }

  const title = formData.get("title")?.toString().trim() || "";
  const description = formData.get("description")?.toString().trim() || "";
  const terms = formData.get("terms")?.toString().trim() || "";

  const startsAtStr = formData.get("startsAt")?.toString();
  const endsAtStr = formData.get("endsAt")?.toString();

  if (!startsAtStr || !endsAtStr) {
    throw new Error("Start and end date are required");
  }

  const startsAt = new Date(startsAtStr);
  const endsAt = new Date(endsAtStr);

  const discountTypeRaw =
    (formData.get("discountType")?.toString() as keyof typeof DiscountType) ||
    "NONE";
  const discountValueStr = formData.get("discountValue")?.toString() || "";

  const discountType: DiscountType = DiscountType[discountTypeRaw] ?? DiscountType.NONE;
  const discountValue =
    discountType === DiscountType.NONE || discountValueStr === ""
      ? null
      : Number(discountValueStr);

  const currency = formData.get("currency")?.toString() || "NGN";
  const city = formData.get("city")?.toString().trim() || "";
  const category = formData.get("category")?.toString().trim() || "";

  const imageUrl = formData.get("imageUrl")?.toString().trim() || null;

  // simple 5-char short code
  const shortCode = Math.random().toString(36).substring(2, 7).toUpperCase();

  await prisma.deal.create({
    data: {
      merchantId,
      title,
      description,
      terms: terms || null,
      startsAt,
      endsAt,
      discountType,
      discountValue,
      currency,
      city,
      category,
      imageUrl,
      shortCode,
    },
  });

  return { success: true, shortCode };
}
