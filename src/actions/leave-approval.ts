"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueEmail, processEmailQueue } from "@/actions/email";
import { revalidatePath } from "next/cache";

async function approverContext() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, canApprove: false };
  const { data: me } = await supabase
    .from("users")
    .select("role, is_leave_approver, is_backup_leave_approver")
    .eq("id", user.id).single();
  const canApprove =
    me?.role === "admin" || me?.role === "super_admin" ||
    !!me?.is_leave_approver || !!me?.is_backup_leave_approver;
  return { user, canApprove };
}

export async function decideLeave(input: {
  id: string;
  version: number;
  decision: "approve" | "reject";
  rejectionReason?: string;
}) {
  const { user, canApprove } = await approverContext();
  if (!user || !canApprove) return { ok: false, error: "Forbidden" };

  const admin = createAdminClient();
  const { data: lr } = await admin
    .from("leave_requests")
    .select("id, user_id, start_date, end_date, days_count, status, version")
    .eq("id", input.id).single();
  if (!lr) return { ok: false, error: "Request not found." };
  if (lr.status !== "pending") return { ok: false, error: `Already ${lr.status}.` };
  if (lr.version !== input.version) return { ok: false, error: "Version conflict — refresh." };
  if (lr.user_id === user.id) return { ok: false, error: "You cannot decide your own leave." };

  const newStatus = input.decision === "approve" ? "approved" : "rejected";
  const { data: done, error } = await admin
    .from("leave_requests")
    .update({
      status: newStatus,
      approver_id: user.id,
      decided_at: new Date().toISOString(),
      rejection_reason: input.decision === "reject" ? (input.rejectionReason ?? null) : null,
    })
    .eq("id", input.id).eq("version", input.version).eq("status", "pending")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!done || done.length === 0) return { ok: false, error: "Version conflict — refresh." };

  if (input.decision === "approve") {
    const { data: u } = await admin.from("users").select("leave_balance").eq("id", lr.user_id).single();
    const newBalance = Math.max(0, Number(u?.leave_balance ?? 0) - Number(lr.days_count));
    await admin.from("users").update({ leave_balance: newBalance }).eq("id", lr.user_id);
  }

  await admin.from("audit_log").insert({
    actor_id: user.id, target_user_id: lr.user_id,
    action: `leave_${newStatus}`, entity: "leave_requests", entity_id: lr.id,
    details: { days: lr.days_count, reason: input.rejectionReason ?? null },
  });

  const { data: associate } = await admin
    .from("users").select("email").eq("id", lr.user_id).single();
  if (associate?.email) {
    await enqueueEmail({
      template: "leave_decision",
      recipients: [associate.email],
      payload: {
        decision: newStatus, startDate: lr.start_date, endDate: lr.end_date,
        days: lr.days_count, reason: input.rejectionReason ?? "",
      },
    });
    processEmailQueue(5).catch(() => {});
  }

  revalidatePath("/leave");
  revalidatePath(`/leave/${input.id}`);
  return { ok: true };
}
