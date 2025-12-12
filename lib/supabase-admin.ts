// lib/supabase-admin.ts
import { createClient } from "@supabase/supabase-js";

// Use the core Supabase URL and a SERVICE ROLE key (admin privileges)
const supabaseAdminUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseAdminUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing Supabase admin environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)."
  );
}

export const supabaseAdmin = createClient(supabaseAdminUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
  },
});

// Optional default export, in case something imports it as default
export default supabaseAdmin;
