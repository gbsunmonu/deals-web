// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isMerchantProtected(pathname: string) {
  return (
    pathname.startsWith("/merchant") ||
    pathname.startsWith("/api/merchant") ||
    pathname === "/api/redemptions/confirm"
  );
}

function getSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";

  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  return { url, anon };
}

// ✅ Next.js Proxy entrypoint: export named "proxy" (or default export)
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Not a merchant-protected route → do nothing
  if (!isMerchantProtected(pathname)) {
    return NextResponse.next();
  }

  const { url, anon } = getSupabaseEnv();

  // If env is missing, don't hard-crash in dev/build — just allow request through.
  // (Next loads .env for app runtime; node -e won't.)
  if (!url || !anon) {
    return NextResponse.next();
  }

  // Response we can attach cookie changes to
  const res = NextResponse.next();

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If merchant route and not logged in → block/redirect
  if (!user) {
    const isApi = pathname.startsWith("/api");

    if (isApi) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/merchant/:path*", "/api/merchant/:path*", "/api/redemptions/confirm"],
};
