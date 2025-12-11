// app/merchant/profile/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function saveMerchantProfile(formData: FormData) {
  const id = formData.get("id") as string;

  const avatarUrlRaw = (formData.get("avatarUrl") as string | null) || "";

  const data = {
    name: (formData.get("name") as string | null)?.trim() || "",
    description: (formData.get("description") as string | null)?.trim() || "",
    category: (formData.get("category") as string | null)?.trim() || "",
    city: (formData.get("city") as string | null)?.trim() || "",
    address: (formData.get("address") as string | null)?.trim() || "",
    phone: (formData.get("phone") as string | null)?.trim() || "",
    website: (formData.get("website") as string | null)?.trim() || "",
    avatarUrl: avatarUrlRaw.trim() || null,
  };

  await prisma.merchant.update({
    where: { id },
    data,
  });

  // Refresh profile pages
  revalidatePath("/merchant/profile");
  revalidatePath("/merchant/profile/edit");
}
