import { createClient } from "@/lib/supabase/server";
import { ProfileLeave } from "@/components/profile-leave";

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, phone, join_date, leave_balance")
    .eq("id", user!.id).single();

  const { data: pending } = await supabase
    .from("profile_update_requests")
    .select("requested_changes, created_at")
    .eq("user_id", user!.id).eq("status", "pending").maybeSingle();

  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, day_type, days_count, status, version, rejection_reason")
    .eq("user_id", user!.id).order("created_at", { ascending: false });

  return (
    <ProfileLeave
      profile={profile as any}
      pending={(pending as any) ?? null}
      leaves={(leaves as any) ?? []}
    />
  );
}
