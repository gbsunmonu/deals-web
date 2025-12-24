// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { getServerSupabaseRSC } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

import AuthSync from "@/components/AuthSync";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yes to Deals · Local deals with QR codes",
  description:
    "Discover and redeem local discounts with QR codes. No account needed for customers – only merchants manage deals.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let isMerchant = false;

  try {
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: user.id as any },
        select: { id: true },
      });

      isMerchant = !!merchant;
    }
  } catch {
    isMerchant = false;
  }

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <AuthSync />

        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative h-9 w-9 overflow-hidden rounded-2xl">
                <Image
                  src="/dealina-logo.png"
                  alt="Yes to Deals"
                  fill
                  priority
                  sizes="36px"
                  className="object-cover"
                />
              </div>

              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold tracking-tight">
                  Yes to Deals
                </span>
                <span className="text-[10px] text-slate-400">
                  Save more locally
                </span>
              </div>
            </Link>

            <nav className="flex flex-wrap items-center gap-3 text-[11px] sm:gap-4 sm:text-sm">
              <Link
                href="/explore"
                className="rounded-full px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Explore deals
              </Link>

              {isMerchant ? (
                <>
                  <Link
                    href="/merchant/profile"
                    className="rounded-full px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Merchant home
                  </Link>

                  {/* ✅ RESTORED */}
                  <Link
                    href="/merchant/analytics"
                    className="rounded-full px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Analytics
                  </Link>

                  <Link
                    href="/merchant/profile/edit"
                    className="rounded-full px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit profile
                  </Link>

                  <Link
                    href="/merchant/redeem"
                    className="rounded-full px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Redeem QR
                  </Link>

                  <Link
                    href="/merchant/abuse"
                    className="rounded-full px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Abuse
                  </Link>

                  <LogoutButton />
                </>
              ) : (
                <Link
                  href="/login?returnTo=/merchant/profile"
                  className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 sm:text-sm"
                >
                  Merchant login
                </Link>
              )}
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
