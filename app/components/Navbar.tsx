// app/components/Navbar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function Navbar() {
  const [isMerchant, setIsMerchant] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setIsMerchant(!!user);
      } catch {
        setIsMerchant(false);
      } finally {
        setLoading(false);
      }
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      run();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        {/* LOGO */}
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
            <span className="text-[10px] text-slate-400">Save more locally</span>
          </div>
        </Link>

        {/* NAV */}
        <nav className="flex flex-wrap items-center gap-3 text-[11px] sm:gap-4 sm:text-sm">
          <Link
            href="/explore"
            className="rounded-full px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Explore deals
          </Link>

          {/* If you want ONLY merchants to see merchant links, keep them behind auth on server layout.
              This Navbar is just a simple client helper (safe fallback). */}
          {!loading && !isMerchant ? (
            <Link
              href="/login?returnTo=/merchant/profile"
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 sm:text-sm"
            >
              Merchant login
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
