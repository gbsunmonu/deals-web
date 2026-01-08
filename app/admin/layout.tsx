// app/admin/layout.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, hashAdminPassword, safeEqual } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ Allow the login page to render (avoid redirect loop)
  const h = await headers();
  const path = h.get("x-invoke-path") || h.get("next-url") || "";
  // Fallback: if we can't read path reliably, still try to allow /admin/login
  const isLoginRoute =
    path.includes("/admin/login") ||
    // extra safety for some runtimes
    h.get("referer")?.includes("/admin/login");

  if (isLoginRoute) {
    return <>{children}</>;
  }

  const pw = process.env.ADMIN_PASSWORD || "";
  if (!pw) {
    redirect("/admin/login?err=missing_password");
  }

  const expected = hashAdminPassword(pw);
  const jar = await cookies();
  const got = jar.get(ADMIN_COOKIE)?.value || "";

  const ok = got && safeEqual(got, expected);

  if (!ok) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}
