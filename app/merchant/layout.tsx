// app/merchant/layout.tsx
import { getServerSupabaseRSC } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → go to merchant login
  if (!user) {
    redirect("/login?returnTo=/merchant/profile");
  }

  // Logged in but not a merchant → go to merchant onboarding (or a simple page)
  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id as any },
    select: { id: true },
  });

  if (!merchant) {
    // You can change this later to /merchant/onboarding
    redirect("/merchant");
  }

  return <>{children}</>;
}
