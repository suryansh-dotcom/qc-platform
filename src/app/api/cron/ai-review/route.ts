import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAiAssessment } from "@/lib/ai";
import { consecutiveRollovers, repetitivePlanRatio, rawScore } from "@/lib/signals";
import { ratio } from "@/lib/utils";
import { istDateKey, nowIST } from "@/lib/dates";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();

  const toKey = istDateKey(nowIST());
  const fromKey = istDateKey(subDays(nowIST(), 6));

  const { data: associates } = await admin
    .from("users").select("id, full_name, team_id, join_date").eq("role", "associate").eq("is_active", true);

  let processed = 0;
  let aiUsed = false;
  const chunkSize = 10;

  for (let i = 0; i < (associates ?? []).length; i += chunkSize) {
    const chunk = (associates ?? []).slice(i, i + chunkSize);

    const contexts: any[] = [];
    const rawByUser = new Map<string, any>();

    for (const a of chunk) {
      const { data: entries } = await admin
        .from("daily_entries")
        .select("entry_date, unique_reviewed, rework_reviews, items_passed, items_failed, hours_worked, plan_for_today, plan_for_tomorrow, defect_category_tags")
        .eq("user_id", a.id).gte("entry_date", fromKey).lte("entry_date", toKey).order("entry_date");

      const e = entries ?? [];
      const u = e.reduce((s, r) => s + r.unique_reviewed, 0);
      const p = e.reduce((s, r) => s + r.items_passed, 0);
      const f = e.reduce((s, r) => s + r.items_failed, 0);
      const passRate = ratio(p, p + f);
      const rollovers = consecutiveRollovers(e as any);
      const repetition = repetitivePlanRatio(e as any);
      const score = rawScore({ unique: u, passRate, defectRate: ratio(f, p + f), target: Math.max(1, u) });

      const raw = {
        unique: u, passRate, defectRate: ratio(f, p + f),
        consecutive_rollovers: rollovers, repetitive_plan_ratio: repetition, score,
      };
      rawByUser.set(a.id, raw);
      contexts.push({
        user_id: a.id, name: a.full_name, team_id: a.team_id,
        metrics: raw,
        defect_tags: e.flatMap((r) => r.defect_category_tags),
      });
    }

    const assessment = await runAiAssessment({ window: { fromKey, toKey }, users: contexts });
    if (assessment) aiUsed = true;

    for (const a of chunk) {
      const raw = rawByUser.get(a.id);
      const note = assessment?.per_user_notes?.[a.id] ?? null;
      const alerts = (assessment?.systemic_alerts ?? []).filter(
        (al) => !al.user_ids || al.user_ids.includes(a.id)
      );
      await admin.from("performance_evals").upsert({
        user_id: a.id, team_id: a.team_id, period_type: "weekly",
        period_start: fromKey, period_end: toKey,
        raw_metrics: raw, score: raw.score,
        ai_status: assessment ? "ok" : "failed",
        ai_analysis: note ? { note } : null,
        systemic_alerts: alerts,
      }, { onConflict: "user_id,period_type,period_start,period_end" });
      processed += 1;
    }
  }

  return NextResponse.json({ ok: true, processed, ai_used: aiUsed, degraded: !aiUsed });
}

// Vercel Cron always invokes via GET; Supabase pg_cron/pg_net uses POST.
export async function GET(request: Request) {
  return POST(request);
}
