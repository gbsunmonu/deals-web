// app/components/Navbar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

type MerchantMeResponse =
  | {
      ok: true;
      isAuthed: boolean;
      isMerchant: boolean;
      merchant?: { id: string; name: string } | null;
    }
  | { ok: false; isAuthed?: boolean; isMerchant?: boolean; error?: string };

function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // In case you only set SUPABASE_URL in .env, still prefer NEXT_PUBLIC_* for client
  const finalUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const finalAnon = anon || "";

  // If missing, nav still renders but will behave as public
  if (!finalUrl || !finalAnon) return null;

  return createBrowserClient(finalUrl, finalAnon);
}

export default function Navbar() {
  const [isMerchant, setIsMerchant] = useState(false);

  const refreshMerchantState = useCallback(async () => {
    try {
      const res = await fetch("/api/merchant/me", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as MerchantMeResponse;

      if ((data as any)?.ok) {
        setIsMerchant(!!(data as any).isMerchant);
      } else {
        setIsMerchant(false);
      }
    } catch {
      setIsMerchant(false);
    }
  }, []);

  useEffect(() => {
    refreshMerchantState();

    // Listen to auth changes so tabs update immediately (logout/login)
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshMerchantState();
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, [refreshMerchantState]);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2">
          <div className="relative h-9 w-9 overflow-hidden rounded-2xl">
            <Image
              src="/dealina-logo.png"
              alt="Dealina"
              fill
              priority
              sizes="36px"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Dealina</span>
            <span className="text-[10px] text-slate-400">Save more locally</span>
          </div>
        </Link>

        {/* NAV LINKS */}
        <nav className="flex flex-wrap items-center gap-3 text-[11px] sm:gap-4 sm:text-sm">
          {/* Public always */}
          <Link
            href="/explore"
            className="rounded-full px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Explore deals
          </Link>

          {/* Merchant-only */}
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

              {/* Logout */}
              <Link
                href="/logout"
                className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Logout
              </Link>
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
