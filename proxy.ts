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

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // If not protected, just continue
  if (!isMerchantProtected(pathname)) {
    return NextResponse.next();
  }

  // Create response for cookie writes
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return res;

  // Not authenticated
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

/**
 * Next.js proxy matcher (equivalent of middleware matcher)
 */
export const config = {
  matcher: ["/merchant/:path*", "/api/merchant/:path*", "/api/redemptions/confirm"],
};
