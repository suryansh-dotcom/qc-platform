import { createClient as createServiceClient } from "@supabase/supabase-js";

// Service-role client. Server-only. Bypasses RLS — never import into client code.
// Used by background jobs and the admin override layer where elevated writes are
// explicitly authorized after an in-app role check.
export function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
