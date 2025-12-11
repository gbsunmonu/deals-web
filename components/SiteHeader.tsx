// components/SiteHeader.tsx
import Link from "next/link";
import Image from "next/image";

export default function SiteHeader() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        {/* Logo + brand */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/90">
            {/* Uses the logo you added in /public/dealina-logo.svg */}
            <Image
              src="/dealina-logo.svg"
              alt="Dealina logo"
              width={24}
              height={24}
              priority
            />
          </div>
          <span className="text-sm font-semibold tracking-tight sm:text-base">
            Dealina
          </span>
        </Link>

        {/* Main nav */}
        <nav className="hidden items-center gap-4 text-xs text-slate-600 sm:flex sm:text-sm">
          <Link href="/explore" className="hover:text-slate-900">
            Explore deals
          </Link>
          <Link href="/my-deals" className="hover:text-slate-900">
            My deals
          </Link>
          <Link href="/redemptions" className="hover:text-slate-900">
            Redemptions
          </Link>
          <Link href="/merchant/tools" className="hover:text-slate-900">
            Merchant tools
          </Link>
          <Link href="/merchant/profile" className="hover:text-slate-900">
            My account
          </Link>
        </nav>

        {/* Auth CTA – client SignInCard handles real auth */}
        <div className="flex items-center gap-2">
          <Link
            href="/auth/sign-in"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:px-4 sm:py-1.5 sm:text-sm"
          >
            Sign in / Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
