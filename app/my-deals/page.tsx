// app/my-deals/page.tsx
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export default async function MyDealsPage() {
  // Get the current Supabase user (server-side)
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1) Not logged in → send to login, and after login go to merchant deals
  if (!user) {
    redirect("/login?next=/merchant/deals");
  }

  // 2) Logged in: make sure they have a merchant profile
  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!merchant) {
    // No merchant yet → send them to set up their business profile
    redirect("/merchant/profile");
  }

  // 3) Merchant exists → send straight to the main merchant deals page
  redirect("/merchant/deals");
}
