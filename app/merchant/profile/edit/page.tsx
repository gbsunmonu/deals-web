// app/merchant/profile/edit/page.tsx

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import MerchantProfileForm from "../MerchantProfileForm";

export default async function MerchantProfileEditPage() {
  // ✅ createSupabaseServer returns a Promise → await it
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[/merchant/profile/edit] auth error:", authError);
  }

  // If not logged in, send to sign-in and then back here
  if (!user) {
    redirect("/auth/sign-in?next=/merchant/profile/edit");
  }

  // Find merchant linked to this Supabase user
  let merchant = await prisma.merchant.findFirst({
    where: { userId: user.id },
  });

  // If merchant doesn’t exist yet, create a basic one
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-500">
            MERCHANT
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            Edit profile
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Update your business details and upload your logo. These changes
            will appear on all your deals.
          </p>
        </div>

        <Link
          href="/merchant/profile"
          className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to profile
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <MerchantProfileForm merchant={merchant} />
      </section>
    </main>
  );
}
