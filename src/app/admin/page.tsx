import { createClient } from "@/lib/supabase/server";
import { AdminConsole } from "@/components/admin-console";

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("users").select("role").eq("id", user!.id).single();

  const { data: reqs } = await supabase
    .from("profile_update_requests")
    .select("id, user_id, version, requested_changes, created_at, user:users!profile_update_requests_user_id_fkey(full_name, phone, avatar_url)")
    .eq("status", "pending").order("created_at");

  const items = (reqs ?? []).map((r: any) => ({ ...r, user: Array.isArray(r.user) ? r.user[0] : r.user }));
  return <AdminConsole role={me!.role as any} pendingProfiles={items as any} />;
}
