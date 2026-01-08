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

  if (!user) {
    redirect("/login?returnTo=/merchant/profile");
  }

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id as any },
    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    redirect("/merchant/profile/edit");
  }

  // Temporary banner until Merchant.status exists in DB + Prisma client
  return (
    <div style={{ minHeight: "100vh" }}>
      <div
        style={{
          padding: 12,
          background: "#eef6ff",
          borderBottom: "1px solid #cfe3ff",
          fontFamily: "ui-sans-serif, system-ui",
        }}
      >
        <b>Note:</b> Merchant verification fields not installed yet. Run Prisma
        migration to enable VERIFIED/PENDING/SUSPENDED logic.
      </div>

      <div>{children}</div>
    </div>
  );
}
