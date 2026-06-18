import { createClient } from "@/lib/supabase/server";
import { TeamPicker } from "@/components/team-picker";
import { ratio } from "@/lib/utils";
import { istDateKey, nowIST } from "@/lib/dates";
import { subDays } from "date-fns";

export default async function TeamDashboard({
  searchParams,
}: { searchParams: { team?: string } }) {
  const supabase = createClient();
  const { data: teams } = await supabase.from("teams").select("id, name").order("name");
  const teamId = searchParams.team;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Team dashboard</h1>
        <TeamPicker teams={teams ?? []} />
      </div>

      {!teamId ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Select a team to load metrics. No queries run until a team is chosen.
        </div>
      ) : (
        <TeamBody teamId={teamId} />
      )}
    </div>
  );
}

async function TeamBody({ teamId }: { teamId: string }) {
  const supabase = createClient();
  const from = istDateKey(subDays(nowIST(), 6));
  const to = istDateKey(nowIST());

  const { data: entries } = await supabase
    .from("daily_entries")
    .select("user_id, unique_reviewed, rework_reviews, items_passed, items_failed, hours_worked, verification_status, user:users!daily_entries_user_id_fkey(full_name)")
    .eq("team_id", teamId).gte("entry_date", from).lte("entry_date", to);

  const agg = new Map<string, any>();
  for (const e of (entries ?? []) as any[]) {
    const name = Array.isArray(e.user) ? e.user[0]?.full_name : e.user?.full_name;
    const a = agg.get(e.user_id) ?? { name, u: 0, rw: 0, p: 0, f: 0, h: 0, mismatch: 0 };
    a.u += e.unique_reviewed; a.rw += e.rework_reviews; a.p += e.items_passed;
    a.f += e.items_failed; a.h += e.hours_worked;
    if (e.verification_status === "mismatch") a.mismatch += 1;
    agg.set(e.user_id, a);
  }
  const rows = [...agg.values()]
    .map((a) => ({ ...a, passRate: ratio(a.p, a.p + a.f) }))
    .sort((x, y) => y.u - x.u);

  // Rankings from performance_evals (RLS already redacts the viewer's own row).
  const { data: evals } = await supabase
    .from("performance_evals")
    .select("user_id, score, raw_metrics, systemic_alerts, ai_status, user:users!performance_evals_user_id_fkey(full_name)")
    .eq("team_id", teamId).eq("period_type", "weekly").order("score", { ascending: false }).limit(50);

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Trailing 7 days</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-400">
            <tr><th className="py-1">Associate</th><th>Unique</th><th>Rework</th><th>Pass%</th><th>Hours</th><th>Mismatch</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1">{r.name}</td><td>{r.u}</td><td>{r.rw}</td>
                <td>{r.passRate}</td><td>{r.h}</td><td>{r.mismatch || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-3 text-slate-400">No entries in range.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Performance rankings {evals?.[0]?.ai_status === "ok" ? "(AI-assisted)" : "(raw math)"}
        </h2>
        <ol className="space-y-1 text-sm">
          {(evals ?? []).map((ev: any, i) => {
            const name = Array.isArray(ev.user) ? ev.user[0]?.full_name : ev.user?.full_name;
            return (
              <li key={i} className="flex items-center justify-between border-t border-slate-100 py-1">
                <span><b>{i + 1}.</b> {name}</span>
                <span className="text-slate-500">score {ev.score}
                  {ev.systemic_alerts?.length ? ` · ${ev.systemic_alerts.length} alert(s)` : ""}</span>
              </li>
            );
          })}
          {(evals ?? []).length === 0 && <li className="py-2 text-slate-400">No evaluations yet (run the AI review job).</li>}
        </ol>
      </section>
    </div>
  );
}
