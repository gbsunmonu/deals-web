// app/merchant/deals/[id]/edit/actions.ts
"use server";

import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function saveDealAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) {
    throw new Error("Missing deal id");
  }

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const originalPriceRaw = String(formData.get("originalPrice") || "");
  const discountValueRaw = String(formData.get("discountValue") || "");
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const startsAtRaw = String(formData.get("startsAt") || "");
  const endsAtRaw = String(formData.get("endsAt") || "");

  const originalPrice = originalPriceRaw
    ? Number.parseInt(originalPriceRaw, 10)
    : null;
  const discountValue = discountValueRaw
    ? Number.parseInt(discountValueRaw, 10)
    : 0;

  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;

  if (!title) {
    throw new Error("Title is required");
  }
  if (!startsAt || !endsAt) {
    throw new Error("Start and end date are required");
  }

  await prisma.deal.update({
    where: { id },
    data: {
      title,
      description,
      originalPrice: originalPrice ?? null,
      discountValue,
      // discountType decided by discountValue on create; here just keep existing type
      imageUrl: imageUrl || null,
      startsAt,
      endsAt,
    },
  });

  redirect("/merchant/deals");
}
