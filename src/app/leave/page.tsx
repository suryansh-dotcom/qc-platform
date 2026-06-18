import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LeaveInbox() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("users").select("role, is_leave_approver, is_backup_leave_approver").eq("id", user.id).single();
  const canApprove =
    me?.role === "admin" || me?.role === "super_admin" ||
    !!me?.is_leave_approver || !!me?.is_backup_leave_approver;
  if (!canApprove) redirect("/daily");

  const { data: pending } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, days_count, day_type, reason, applicant:users!leave_requests_user_id_fkey(full_name)")
    .eq("status", "pending").order("created_at");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-4 text-base font-semibold">Pending leave requests</h1>
      <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
        {(pending ?? []).length === 0 && <p className="p-4 text-sm text-slate-400">Nothing pending.</p>}
        {(pending ?? []).map((l: any) => {
          const a = Array.isArray(l.applicant) ? l.applicant[0] : l.applicant;
          return (
            <Link key={l.id} href={`/leave/${l.id}`}
              className="flex items-center justify-between p-4 text-sm hover:bg-slate-50">
              <div>
                <span className="font-medium">{a?.full_name ?? "—"}</span>
                <span className="ml-2 text-slate-500">{l.start_date} → {l.end_date} · {l.days_count}d</span>
              </div>
              <span className="text-xs text-slate-400">{l.reason || "—"}</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
