// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PREFIXES = [
  '/login',
  '/confirm',
  '/api',          // your API routes
  '/_next',        // Next assets
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/r',            // public deal pages
  '/',             // homepage
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isDemoMode() {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true'
  );
}

function hasSupabaseSession(req: NextRequest) {
  // Supabase sets a cookie like: `sb-<project-ref>-auth-token` (JSON array)
  // Also check for common tokens in case your setup differs.
  const cookies = req.cookies.getAll();
  const hasSbAuthToken = cookies.some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  );
  const hasAccessToken = cookies.some((c) => c.name === 'sb-access-token');
  const hasSession = cookies.some((c) => c.name === 'session');

  return hasSbAuthToken || hasAccessToken || hasSession;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always allow public pages/assets
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // In demo mode, allow merchant area without auth
  if (isDemoMode() && pathname.startsWith('/merchant')) {
    return NextResponse.next();
  }

  // Require auth for merchant area
  if (pathname.startsWith('/merchant')) {
    if (!hasSupabaseSession(req)) {
      // Avoid loops: if somehow on /login already, just allow it
      if (pathname.startsWith('/login')) return NextResponse.next();

      const redirectTo = `/login?redirect=${encodeURIComponent(pathname + search)}`;
      const url = new URL(redirectTo, req.nextUrl.origin);

      // Clean up stale cookies that can cause loops
      const res = NextResponse.redirect(url);
      res.cookies.delete('sb-access-token');
      res.cookies.delete('sb-refresh-token');
      // The sb-*-auth-token is a JSON cookie; we can’t know the exact name here.
      // Browser cookies will be replaced once a fresh session is created.

      return res;
    }
  }

  return NextResponse.next();
}

// Limit middleware to everything except obvious static bits.
// (We still check public paths inside the middleware.)
export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)'],
};
