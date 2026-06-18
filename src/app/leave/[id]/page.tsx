import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeaveDecision } from "@/components/leave-approval";

export default async function LeaveApprovalPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("users")
    .select("role, is_leave_approver, is_backup_leave_approver")
    .eq("id", user.id).single();
  const canApprove =
    me?.role === "admin" || me?.role === "super_admin" ||
    !!me?.is_leave_approver || !!me?.is_backup_leave_approver;
  if (!canApprove) redirect("/daily");

  const { data: lr } = await supabase
    .from("leave_requests")
    .select("id, user_id, start_date, end_date, day_type, days_count, reason, status, version, applicant:users!leave_requests_user_id_fkey(full_name, email)")
    .eq("id", params.id).maybeSingle();
  if (!lr) notFound();

  const applicant: any = Array.isArray((lr as any).applicant) ? (lr as any).applicant[0] : (lr as any).applicant;
  const ownRequest = lr.user_id === user.id;

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-md border border-slate-200 bg-white p-6">
        <h1 className="text-sm font-semibold">Leave approval</h1>
        <dl className="mt-4 space-y-1 text-sm">
          <Row k="Applicant" v={applicant?.full_name ?? applicant?.email ?? lr.user_id} />
          <Row k="Span" v={`${lr.start_date} → ${lr.end_date}`} />
          <Row k="Days" v={`${lr.days_count} (${lr.day_type})`} />
          <Row k="Reason" v={lr.reason || "—"} />
          <Row k="Status" v={lr.status} />
        </dl>

        {lr.status !== "pending" ? (
          <p className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            This request is already <b>{lr.status}</b>.
          </p>
        ) : ownRequest ? (
          <p className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            You cannot decide your own leave request.
          </p>
        ) : (
          <LeaveDecision id={lr.id} version={lr.version} />
        )}
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1">
      <dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd>
    </div>
  );
}
