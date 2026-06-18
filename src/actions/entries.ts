"use server";
import { createClient } from "@/lib/supabase/server";
import { isPastLockWindow } from "@/lib/dates";
import { revalidatePath } from "next/cache";

type EntryInput = {
  entry_date: string;
  unique_reviewed: number;
  rework_reviews: number;
  items_passed: number;
  items_failed: number;
  hours_worked: number;
  defect_category_tags: string[];
  plan_for_today: string;
  plan_for_tomorrow: string;
};

export async function upsertDailyEntry(input: EntryInput) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  if (isPastLockWindow(input.entry_date)) {
    return { ok: false, error: "This day is locked (past the 24h buffer)." };
  }
  if (input.hours_worked < 0 || input.hours_worked > 24) {
    return { ok: false, error: "Hours worked must be between 0 and 24." };
  }
  for (const k of ["unique_reviewed", "rework_reviews", "items_passed", "items_failed"] as const) {
    if (input[k] < 0) return { ok: false, error: `${k} cannot be negative.` };
  }

  const { data: profile } = await supabase
    .from("users").select("team_id").eq("id", user.id).single();

  const { error } = await supabase.from("daily_entries").upsert(
    {
      user_id: user.id,
      team_id: profile?.team_id ?? null,
      entry_date: input.entry_date,
      unique_reviewed: input.unique_reviewed,
      rework_reviews: input.rework_reviews,
      items_passed: input.items_passed,
      items_failed: input.items_failed,
      hours_worked: input.hours_worked,
      defect_category_tags: input.defect_category_tags,
      plan_for_today: input.plan_for_today,
      plan_for_tomorrow: input.plan_for_tomorrow,
    },
    { onConflict: "user_id,entry_date" }
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/daily");
  return { ok: true };
}

export async function registerAttachment(meta: {
  daily_entry_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (meta.file_size_bytes > 10 * 1024 * 1024)
    return { ok: false, error: "File exceeds 10MB cap." };

  const { error } = await supabase.from("daily_attachments").insert({
    ...meta,
    user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
