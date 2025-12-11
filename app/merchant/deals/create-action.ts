// deals-web/app/merchant/deals/create-action.ts
"use server";

import { redirect } from "next/navigation";
import prisma from "../../../utils/prismaClient";
import { getCurrentMerchant } from "../../../utils/current-merchant";

function toNumber(value: FormDataEntryValue | null, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export async function createDealAction(formData: FormData) {
  // 1. Find the merchant that belongs to the logged-in user
  const merchant = await getCurrentMerchant();

  if (!merchant) {
    throw new Error("You must be signed in as a merchant to create a deal.");
  }

  // 2. Read form fields
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const originalPrice = toNumber(formData.get("originalPrice"));
  const discountPercent = toNumber(formData.get("discountPercent"));

  const startsAtRaw = (formData.get("startsAt") as string) ?? "";
  const endsAtRaw = (formData.get("endsAt") as string) ?? "";

  const imageUrl =
    (formData.get("imageUrl") as string | null | undefined) ?? null;

  // 3. Basic validation (you can extend this as you like)
  if (!title) {
    throw new Error("Title is required");
  }

  if (!startsAtRaw || !endsAtRaw) {
    throw new Error("Start and end dates are required");
  }

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(endsAtRaw);

  // discountValue = how much money is taken off
  const discountValue = Math.round((originalPrice * discountPercent) / 100);

  // 4. Create the deal, **attaching the correct merchantId**
  await prisma.deal.create({
    data: {
      title,
      description,
      originalPrice,
      discountValue,
      startsAt,
      endsAt,
      imageUrl,
      merchantId: merchant.id, // 👈 THIS is the key line
    },
  });

  // 5. Go back to the merchant's My deals page
  redirect("/merchant/deals");
}

// Optional: keep the old name if your form imports `createDeal` instead
export { createDealAction as createDeal };
