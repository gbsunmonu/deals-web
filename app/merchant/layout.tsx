// app/merchant/layout.tsx
import { redirect } from "next/navigation";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

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

  // 1) Must be logged in
  if (!user) {
    redirect("/login?returnTo=/merchant/profile");
  }

  // 2) Must have a Merchant row
  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id as any },
    select: { id: true },
  });

  if (!merchant) {
    // If they logged in but don't have a merchant profile row yet
    redirect("/merchant/profile/edit");
  }

  return <>{children}</>;
}
