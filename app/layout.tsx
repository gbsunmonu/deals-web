// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

import AuthSync from "@/components/AuthSync";
import SiteHeader from "@/components/SiteHeader";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yes to Deals",
  description: "Discover and redeem local deals in Nigeria",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // We only need to know whether a user is signed in (to show merchant links).
  // No Prisma calls here = fewer runtime crashes.
  let isAuthed = false;

  try {
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    isAuthed = !!user;
  } catch {
    isAuthed = false;
  }

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <AuthSync />
        <SiteHeader isAuthed={isAuthed} />
        <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
