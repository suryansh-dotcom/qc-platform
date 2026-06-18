import { createClient } from "@/lib/supabase/server";
import { MetricsCharts } from "@/components/metrics-charts";
import { ratio } from "@/lib/utils";
import { istDateKey, nowIST } from "@/lib/dates";
import { subDays, format, parseISO } from "date-fns";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const from = istDateKey(subDays(nowIST(), 30));

  const { data: entries } = await supabase
    .from("daily_entries")
    .select("entry_date, unique_reviewed, rework_reviews, items_passed, items_failed, hours_worked")
    .eq("user_id", user!.id).gte("entry_date", from).order("entry_date");

  const rows = (entries ?? []).map((e) => {
    const total = e.items_passed + e.items_failed;
    return {
      date: format(parseISO(e.entry_date), "dd MMM"),
      throughput: e.unique_reviewed,
      rework: e.rework_reviews,
      passRate: ratio(e.items_passed, total),
      defectRate: ratio(e.items_failed, total),
      hours: e.hours_worked,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold">Your performance</h1>
        <p className="text-sm text-slate-500">Personal trends over the last 30 days. Private to you.</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No entries yet. Log a day to see trends.</p>
      ) : (
        <MetricsCharts rows={rows} />
      )}
    </div>
  );
}
