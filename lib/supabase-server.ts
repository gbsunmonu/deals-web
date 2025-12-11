import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Do NOT call this from app/layout.tsx.
// Use it inside server pages, server actions, and route handlers.
export function createSupabaseServer() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      // Next 16: cookies() is async. Use await cookies() before .get/.set.
      async get(name: string) {
        const store = await cookies();
        return store.get(name)?.value;
      },
      async set(name: string, value: string, options: CookieOptions) {
        try {
          (await cookies()).set({ name, value, ...options });
        } catch {
          // Ignore when called from a non-mutable context (e.g. plain RSC render)
        }
      },
      async remove(name: string, options: CookieOptions) {
        try {
          (await cookies()).set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // Ignore when called from a non-mutable context
        }
      },
    },
  });
}
