"use server";
import { createClient } from "@/lib/supabase/server";
import { countLeaveDays } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueEmail, processEmailQueue } from "@/actions/email";
import { revalidatePath } from "next/cache";

export async function requestLeave(input: {
  start_date: string;
  end_date: string;
  day_type: "full" | "half_first" | "half_second";
  reason: string;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (input.end_date < input.start_date)
    return { ok: false, error: "End date precedes start date." };

  const { data: setting } = await supabase
    .from("settings").select("value").eq("key", "holidays").maybeSingle();
  const holidays: string[] = (setting?.value as { dates?: string[] })?.dates ?? [];

  const days = countLeaveDays(input.start_date, input.end_date, input.day_type, holidays);
  if (days <= 0) return { ok: false, error: "Requested span contains no working days." };

  const { data: inserted, error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    start_date: input.start_date,
    end_date: input.end_date,
    day_type: input.day_type,
    days_count: days,
    reason: input.reason,
    status: "pending",
  }).select("id").single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "Insert failed" };

  // Route notification to the designated primary approver (backup if none).
  const admin = createAdminClient();
  const { data: approvers } = await admin
    .from("users")
    .select("email, is_leave_approver, is_backup_leave_approver")
    .or("is_leave_approver.eq.true,is_backup_leave_approver.eq.true");
  const primary = approvers?.find((a) => a.is_leave_approver)?.email;
  const backup = approvers?.find((a) => a.is_backup_leave_approver)?.email;
  const to = [primary || backup].filter(Boolean) as string[];

  const { data: me } = await admin.from("users").select("full_name").eq("id", user.id).single();
  if (to.length) {
    await enqueueEmail({
      template: "leave_request",
      recipients: to,
      payload: {
        leaveId: inserted.id,
        associateName: me?.full_name ?? user.email,
        startDate: input.start_date,
        endDate: input.end_date,
        dayType: input.day_type,
        days,
        reason: input.reason,
      },
    });
    processEmailQueue(5).catch(() => {});
  }

  revalidatePath("/profile");
  return { ok: true, days };
}

export async function cancelLeave(id: string, version: number) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("version", version)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "Already changed elsewhere — refresh and retry." };
  revalidatePath("/profile");
  return { ok: true };
}
