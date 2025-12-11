import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export async function getCurrentMerchant() {
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id }, // must match the upsert above
  });

  return merchant;
}
