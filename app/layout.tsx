// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Dealina · Local deals with QR codes",
  description:
    "Discover and redeem local discounts with QR codes. No account needed for customers – only merchants manage deals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        {/* TOP NAVBAR */}
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            {/* LOGO → landing page ("/") */}
            <Link href="/" className="flex items-center gap-2">
              {/* App icon from /public */}
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

              {/* Brand text */}
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold tracking-tight">
                  Dealina
                </span>
                <span className="text-[10px] text-slate-400">
                  Save more locally
                </span>
              </div>
            </Link>

            {/* NAV LINKS */}
            <nav className="flex flex-wrap items-center gap-3 text-[11px] sm:gap-4 sm:text-sm">
              <Link
                href="/explore"
                className="rounded-full px-3 py-1 font-semibold text-slate-800 hover:bg-slate-100"
              >
                Explore deals
              </Link>

              <Link
                href="/merchant/profile"
                className="rounded-full px-3 py-1 text-slate-600 hover:bg-slate-100"
              >
                Merchant home
              </Link>

              <Link
                href="/merchant/redemptions"
                className="rounded-full px-3 py-1 text-slate-600 hover:bg-slate-100"
              >
                Redeem QR
              </Link>
            </nav>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
