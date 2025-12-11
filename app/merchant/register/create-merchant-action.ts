"use server";

import prisma from "@/utils/prismaClient";
import { createSupabaseServerClient } from "@/utils/supabase-server";

export async function createMerchant(formData: FormData) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Not authenticated");
  }

  const businessName = formData.get("businessName") as string;

  // Create merchant linked to logged in user
  const merchant = await prisma.merchant.create({
    data: {
      name: businessName,
      userId: user.id,              // 🔥 CRITICAL
      lat: 0,
      lng: 0,
    },
  });

  return merchant;
}
