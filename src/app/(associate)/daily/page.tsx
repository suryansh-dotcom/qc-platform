import { createClient } from "@/lib/supabase/server";
import { DailyEntryForm } from "@/components/daily-entry-form";
import { StatusCalendar } from "@/components/status-calendar";
import { istDateKey, nowIST } from "@/lib/dates";
import { startOfMonth, endOfMonth, subDays } from "date-fns";

export default async function DailyPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const today = istDateKey(nowIST());
  const monthStart = istDateKey(startOfMonth(nowIST()));
  const monthEnd = istDateKey(endOfMonth(nowIST()));
  const yesterday = istDateKey(subDays(nowIST(), 1));

  const { data: todayEntry } = await supabase
    .from("daily_entries").select("*").eq("user_id", user!.id).eq("entry_date", today).maybeSingle();

  const { data: yEntry } = await supabase
    .from("daily_entries").select("plan_for_tomorrow").eq("user_id", user!.id).eq("entry_date", yesterday).maybeSingle();

  const { data: monthEntries } = await supabase
    .from("daily_entries").select("entry_date")
    .eq("user_id", user!.id).gte("entry_date", monthStart).lte("entry_date", monthEnd);

  const { data: leaves } = await supabase
    .from("leave_requests").select("start_date, end_date")
    .eq("user_id", user!.id).eq("status", "approved");

  const leaveDates: string[] = [];
  (leaves ?? []).forEach((l) => {
    let d = new Date(l.start_date + "T00:00:00");
    const end = new Date(l.end_date + "T00:00:00");
    while (d <= end) { leaveDates.push(istDateKey(d)); d = new Date(d.getTime() + 86400000); }
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <DailyEntryForm
        entryDate={today}
        existing={todayEntry as any}
        carriedPlan={yEntry?.plan_for_tomorrow ?? ""}
      />
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <StatusCalendar
          submittedDates={(monthEntries ?? []).map((e) => e.entry_date)}
          leaveDates={leaveDates}
        />
      </div>
    </div>
  );
}
