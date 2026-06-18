"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitProfileUpdate(changes: Record<string, string>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const allowed = ["full_name", "phone", "avatar_url"];
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (allowed.includes(k) && v?.trim()) cleaned[k] = v.trim();
  }
  if (Object.keys(cleaned).length === 0)
    return { ok: false, error: "No valid fields to update." };

  const { data: existing } = await supabase
    .from("profile_update_requests")
    .select("id").eq("user_id", user.id).eq("status", "pending").maybeSingle();
  if (existing)
    return { ok: false, error: "A pending request already awaits verification." };

  const { error } = await supabase.from("profile_update_requests").insert({
    user_id: user.id,
    requested_changes: cleaned,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}
