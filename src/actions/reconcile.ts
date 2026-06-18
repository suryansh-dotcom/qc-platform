"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function requireManager() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("role, team_id").eq("id", user.id).single();
  if (data?.role !== "admin" && data?.role !== "super_admin") return null;
  return { user, team_id: data.team_id as string | null };
}

// Reference rows: { email, entry_date, unique_reviewed }.
// Verified = matches the daily entry; Mismatch = differs; Unverified = no entry.
export async function reconcileReference(rows: Array<Record<string, string>>) {
  const ctx = await requireManager();
  if (!ctx) return { ok: false, error: "Forbidden" };
  const admin = createAdminClient();

  const { data: batch, error: bErr } = await admin
    .from("reference_batches")
    .insert({ uploaded_by: ctx.user.id, team_id: ctx.team_id, row_count: rows.length })
    .select("id").single();
  if (bErr || !batch) return { ok: false, error: bErr?.message ?? "Batch insert failed" };

  let matched = 0, mismatched = 0, unverified = 0;

  for (const r of rows) {
    const email = (r.email || "").trim().toLowerCase();
    const date = (r.entry_date || "").trim();
    const refUnique = Number(r.unique_reviewed);
    if (!email || !date) { unverified++; continue; }

    const { data: u } = await admin.from("users").select("id").ilike("email", email).maybeSingle();
    if (!u) { unverified++; continue; }

    const { data: entry } = await admin
      .from("daily_entries")
      .select("id, unique_reviewed, admin_override")
      .eq("user_id", u.id).eq("entry_date", date).maybeSingle();

    if (!entry) { unverified++; continue; }
    if (entry.admin_override) { matched++; continue; } // frozen, do not disturb

    const isMatch = Number(entry.unique_reviewed) === refUnique;
    await admin.from("daily_entries").update({
      verification_status: isMatch ? "verified" : "mismatch",
      reference_value: isMatch ? null : { unique_reviewed: refUnique },
      reference_batch_id: batch.id,
    }).eq("id", entry.id);
    if (isMatch) matched++; else mismatched++;
  }

  await admin.from("reference_batches").update({ matched, mismatched, unverified }).eq("id", batch.id);
  revalidatePath("/admin/reconcile");
  return { ok: true, matched, mismatched, unverified, batchId: batch.id };
}

// Resolve a mismatch: freeze as admin_override with the chosen authoritative value.
export async function resolveMismatch(input: {
  entryId: string;
  version: number;
  acceptReference: boolean;
}) {
  const ctx = await requireManager();
  if (!ctx) return { ok: false, error: "Forbidden" };
  const admin = createAdminClient();

  const { data: entry } = await admin
    .from("daily_entries").select("id, reference_value, version, user_id").eq("id", input.entryId).single();
  if (!entry) return { ok: false, error: "Entry not found." };
  if (entry.version !== input.version) return { ok: false, error: "Version conflict — refresh." };

  const patch: Record<string, unknown> = {
    verification_status: "admin_override",
    admin_override: true,
  };
  if (input.acceptReference && entry.reference_value) {
    const ref = entry.reference_value as { unique_reviewed?: number };
    if (typeof ref.unique_reviewed === "number") patch.unique_reviewed = ref.unique_reviewed;
  }

  const { data: done } = await admin
    .from("daily_entries").update(patch)
    .eq("id", input.entryId).eq("version", input.version).select("id");
  if (!done || done.length === 0) return { ok: false, error: "Version conflict — refresh." };

  await admin.from("audit_log").insert({
    actor_id: ctx.user.id, target_user_id: entry.user_id,
    action: "mismatch_resolved", entity: "daily_entries", entity_id: input.entryId,
    details: { acceptReference: input.acceptReference },
  });
  revalidatePath("/admin/reconcile");
  return { ok: true };
}
