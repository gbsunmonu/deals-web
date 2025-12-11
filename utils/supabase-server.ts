// deals-web/utils/supabase-server.ts
"use server";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Server-side Supabase client using the Next.js 16 cookies() API.
 * MUST be awaited everywhere you use it.
 */
export async function createSupabaseServerClient() {
  // In Next 16, cookies() is a dynamic API – call it inside the function.
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Supabase only needs getAll + setAll with the new API
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(
                name,
                value,
                options as CookieOptions | undefined
              );
            });
          } catch {
            // Ignore if headers are already sent (can happen in route handlers)
          }
        },
      },
    }
  );
}
