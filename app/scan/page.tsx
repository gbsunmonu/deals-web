// app/scan/page.tsx
import { redirect } from "next/navigation";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import ScanClient from "./scan-client";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  // ✅ Must be logged in
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?returnTo=/scan");
  }

  // ✅ Must be a merchant (Merchant.userId = auth user.id)
  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id as any },
    select: { id: true },
  });

  // ✅ Logged in but not a merchant → send them away
  if (!merchant) {
    redirect("/merchant");
  }

  // ✅ Merchant can scan
  return <ScanClient />;
}
