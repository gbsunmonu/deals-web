// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Dealina",
  description:
    "Discover and redeem local discounts with QR codes. No account needed for customers — only merchants manage deals.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <SiteHeader isAuthed={!!user} />
        {children}
      </body>
    </html>
  );
}
