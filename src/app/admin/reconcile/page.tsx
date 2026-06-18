import { createClient } from "@/lib/supabase/server";
import { ReconcilePanel } from "@/components/reconcile-panel";

export default async function ReconcilePage() {
  const supabase = createClient();
  const { data: mismatches } = await supabase
    .from("daily_entries")
    .select("id, version, entry_date, unique_reviewed, reference_value, user:users!daily_entries_user_id_fkey(full_name)")
    .eq("verification_status", "mismatch").order("entry_date").limit(200);

  const rows = (mismatches ?? []).map((m: any) => ({
    ...m, user: Array.isArray(m.user) ? m.user[0] : m.user,
  }));
  return (
    <div>
      <h1 className="mb-4 text-base font-semibold">Reference reconciliation</h1>
      <ReconcilePanel mismatches={rows as any} />
    </div>
  );
}
