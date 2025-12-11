// app/merchant/profile/edit/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

const MERCHANT_ID = "11111111-1111-1111-1111-111111111111";

function nullIfEmpty(value: FormDataEntryValue | null) {
  const v = (value ?? "").toString().trim();
  return v === "" ? null : v;
}

export async function saveMerchantProfileAction(formData: FormData) {
  const name = (formData.get("name") ?? "").toString().trim();

  if (!name) {
    // For now, simple guard. Later you can surface UI errors.
    throw new Error("Merchant name is required");
  }

  const category = nullIfEmpty(formData.get("category"));
  const description = nullIfEmpty(formData.get("description"));
  const city = nullIfEmpty(formData.get("city"));
  const address = nullIfEmpty(formData.get("address"));
  const phone = nullIfEmpty(formData.get("phone"));
  const website = nullIfEmpty(formData.get("website"));

  await prisma.merchant.update({
    where: { id: MERCHANT_ID },
    data: {
      name,
      category,
      description,
      city,
      address,
      phone,
      website,
    },
  });

  redirect("/merchant/profile");
}
