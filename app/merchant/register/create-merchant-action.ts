"use server";

import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export async function createMerchantFromCurrentUser() {
  // ✅ Get the Supabase client (await the Promise)
  const supabase = await getServerSupabaseRSC();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Not authenticated");
  }

  // ✅ Try to find existing merchant for this user
  let merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
  });

  // ✅ If none, create a basic merchant
  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        userId: user.id,
        name:
          (user.user_metadata?.business_name as string | undefined) ||
          user.email?.split("@")[0] ||
          "New merchant",
        description: "",
        category: "",
        city: "",
        address: "",
        phone: "",
        website: "",
        avatarUrl: null,
      },
    });
  }

  return merchant;
}
