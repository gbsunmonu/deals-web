// app/components/Navbar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";

export default function Navbar({
  isMerchant,
}: {
  isMerchant: boolean;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        {/* Brand */}
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

        {/* Nav */}
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
  );
}
