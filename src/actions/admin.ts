"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const EDITABLE_BY_SUPER = [
  "teams", "users", "leave_requests", "daily_entries", "daily_attachments",
  "benchmarks", "performance_evals", "settings", "profile_update_requests", "feedback",
] as const;
const EDITABLE_BY_ADMIN = EDITABLE_BY_SUPER.filter((t) => t !== "feedback");

type TableName = (typeof EDITABLE_BY_SUPER)[number];

async function authorize() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null as null };
  const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
  return { user, role: (data?.role ?? null) as "super_admin" | "admin" | "associate" | null };
}

// Universal version-checked edit. Verifies role in-app, blocks blind writes via
// the row's current version, then patches through the service-role client and
// records an audit entry. Feedback edits are super-admin-only by design.
export async function adminEditRow(input: {
  table: TableName;
  id: string;
  expectedVersion?: number;
  patch: Record<string, unknown>;
}) {
  const { user, role } = await authorize();
  if (!user || (role !== "admin" && role !== "super_admin"))
    return { ok: false, error: "Forbidden" };

  const allowed = role === "super_admin" ? EDITABLE_BY_SUPER : EDITABLE_BY_ADMIN;
  if (!(allowed as readonly string[]).includes(input.table))
    return { ok: false, error: `Role ${role} cannot edit ${input.table}.` };

  const admin = createAdminClient();

  const hasVersion = typeof input.expectedVersion === "number";
  let q = admin.from(input.table as any).update(input.patch).eq("id", input.id);
  if (hasVersion) q = q.eq("version", input.expectedVersion as number);
  const { data, error } = await q.select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "No row updated — version conflict or missing id. Refresh." };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    target_user_id: (input.patch as any).user_id ?? null,
    action: "admin_edit",
    entity: input.table,
    entity_id: input.id,
    details: { patch: input.patch, role },
  });

  revalidatePath("/admin");
  return { ok: true };
}

// Profile verification queue: approve patches the users row + audits + clears staging.
export async function decideProfileRequest(input: {
  requestId: string;
  version: number;
  decision: "approve" | "reject";
  rejectionReason?: string;
}) {
  const { user, role } = await authorize();
  if (!user || (role !== "admin" && role !== "super_admin"))
    return { ok: false, error: "Forbidden" };
  const admin = createAdminClient();

  const { data: req } = await admin
    .from("profile_update_requests")
    .select("id, user_id, requested_changes, version, status")
    .eq("id", input.requestId).single();
  if (!req || req.status !== "pending")
    return { ok: false, error: "Request is no longer pending." };
  if (req.version !== input.version)
    return { ok: false, error: "Version conflict — refresh and retry." };

  if (input.decision === "approve") {
    const { error: upErr } = await admin
      .from("users").update(req.requested_changes as Record<string, unknown>)
      .eq("id", req.user_id);
    if (upErr) return { ok: false, error: upErr.message };
  }

  const { data: done, error } = await admin
    .from("profile_update_requests")
    .update({
      status: input.decision === "approve" ? "approved" : "rejected",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      rejection_reason: input.decision === "reject" ? (input.rejectionReason ?? null) : null,
    })
    .eq("id", input.requestId).eq("version", input.version).select("id");
  if (error) return { ok: false, error: error.message };
  if (!done || done.length === 0)
    return { ok: false, error: "Version conflict — refresh and retry." };

  await admin.from("audit_log").insert({
    actor_id: user.id, target_user_id: req.user_id,
    action: `profile_${input.decision}`, entity: "profile_update_requests",
    entity_id: input.requestId, details: { requested_changes: req.requested_changes },
  });

  revalidatePath("/admin");
  return { ok: true };
}
