// app/merchant/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MerchantIndex() {
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts should already protect /merchant/*, but keep this as safety
  if (!user) redirect("/merchant/login");

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!merchant) redirect("/merchant/onboarding");
  redirect("/merchant/dashboard");
}
