// app/actions/merchantProfile.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getMerchantId } from "@/lib/session";

export async function updateMerchantProfile(formData: FormData) {
  const merchantId = await getMerchantId();

  if (!merchantId) {
    throw new Error("Not logged in as a merchant");
  }

  const name = formData.get("name")?.toString().trim() || null;
  const city = formData.get("city")?.toString().trim() || null;
  const phone = formData.get("phone")?.toString().trim() || null;
  const mapUrl = formData.get("mapUrl")?.toString().trim() || null;
  const description = formData.get("description")?.toString().trim() || null;

  const data: Record<string, any> = {};

  if (name) data.name = name;
  if (city) data.city = city;
  if (phone) data.phone = phone;
  if (mapUrl) data.mapUrl = mapUrl;
  if (description) data.description = description;

  await prisma.merchant.update({
    where: { id: merchantId },
    data,
  });

  return { success: true };
}
