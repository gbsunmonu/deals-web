// app/merchant/onboarding/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";
import { redirect } from "next/navigation";
import OnboardingClient from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function MerchantOnboardingPage() {
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/merchant/login");

  // If merchant already exists, skip onboarding
  const existing = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      avatarUrl: true,
      category: true,
      address: true,
      city: true,
      phone: true,
      website: true,
      lat: true,
      lng: true,
    },
  });

  if (existing) {
    redirect("/merchant/dashboard");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Create your merchant profile
        </h1>
        <p className="mt-2 text-slate-600">
          This profile is what customers see on your deals. You can edit it later.
        </p>
      </header>

      <OnboardingClient />
    </main>
  );
}
