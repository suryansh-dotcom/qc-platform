import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ratio } from "@/lib/utils";
import { rawScore } from "@/lib/signals";

// Resolve report recipient emails from the settings roster names.
export async function resolveRecipients(kind: "daily" | "weekly"): Promise<string[]> {
  const admin = createAdminClient();
  const { data: s } = await admin.from("settings").select("value").eq("key", "report_recipients").single();
  const names: string[] = (s?.value as any)?.[kind] ?? [];
  if (names.length === 0) return [];
  const { data: users } = await admin.from("users").select("email, full_name").in("full_name", names);
  return (users ?? []).map((u) => u.email).filter(Boolean);
}

export type DailySnapshot = {
  date: string;
  members: Array<{
    name: string; submitted: boolean; flag: "Nudged" | "Shift Pending" | null;
    unique: number; rework: number; passRate: number; hours: number;
    plan_tomorrow: string | null;
  }>;
};

export async function buildDailySnapshot(dateKey: string): Promise<DailySnapshot> {
  const admin = createAdminClient();
  const { data: associates } = await admin
    .from("users").select("id, full_name").eq("role", "associate").eq("is_active", true);

  const { data: entries } = await admin
    .from("daily_entries")
    .select("user_id, unique_reviewed, rework_reviews, items_passed, items_failed, hours_worked, plan_for_tomorrow, is_locked")
    .eq("entry_date", dateKey);
  const byUser = new Map((entries ?? []).map((e) => [e.user_id, e]));

  const members = (associates ?? []).map((a) => {
    const e = byUser.get(a.id);
    if (e) {
      const total = e.items_passed + e.items_failed;
      return {
        name: a.full_name, submitted: true, flag: null as null,
        unique: e.unique_reviewed, rework: e.rework_reviews,
        passRate: ratio(e.items_passed, total), hours: e.hours_worked,
        plan_tomorrow: e.plan_for_tomorrow,
      };
    }
    // Unsubmitted: locked => Nudged (window passed); else Shift Pending.
    return {
      name: a.full_name, submitted: false,
      flag: "Shift Pending" as "Nudged" | "Shift Pending",
      unique: 0, rework: 0, passRate: 0, hours: 0, plan_tomorrow: null,
    };
  });
  return { date: dateKey, members };
}

export type WeeklyRow = {
  user_id: string; name: string; unique: number; rework: number;
  passRate: number; defectRate: number; hours: number; score: number; rank: number;
};

export async function buildWeeklySummary(fromKey: string, toKey: string) {
  const admin = createAdminClient();
  const { data: associates } = await admin
    .from("users").select("id, full_name").eq("role", "associate").eq("is_active", true);
  const { data: entries } = await admin
    .from("daily_entries")
    .select("user_id, unique_reviewed, rework_reviews, items_passed, items_failed, hours_worked")
    .gte("entry_date", fromKey).lte("entry_date", toKey);

  const agg = new Map<string, { u: number; rw: number; p: number; f: number; h: number }>();
  for (const e of entries ?? []) {
    const a = agg.get(e.user_id) ?? { u: 0, rw: 0, p: 0, f: 0, h: 0 };
    a.u += e.unique_reviewed; a.rw += e.rework_reviews;
    a.p += e.items_passed; a.f += e.items_failed; a.h += e.hours_worked;
    agg.set(e.user_id, a);
  }

  let rows: WeeklyRow[] = (associates ?? []).map((m) => {
    const a = agg.get(m.id) ?? { u: 0, rw: 0, p: 0, f: 0, h: 0 };
    const total = a.p + a.f;
    const passRate = ratio(a.p, total);
    const score = rawScore({ unique: a.u, passRate, defectRate: ratio(a.f, total), target: Math.max(1, a.u) });
    return {
      user_id: m.id, name: m.full_name, unique: a.u, rework: a.rw,
      passRate, defectRate: ratio(a.f, total), hours: a.h, score, rank: 0,
    };
  });
  rows.sort((x, y) => y.unique - x.unique || y.passRate - x.passRate);
  rows = rows.map((r, i) => ({ ...r, rank: i + 1 }));

  // Feedback metrics are super-admin-only; included here for the super-admin email.
  const { count: feedbackCount } = await admin
    .from("feedback").select("*", { count: "exact", head: true })
    .gte("submitted_date", fromKey).lte("submitted_date", toKey);

  return { fromKey, toKey, rows, feedbackCount: feedbackCount ?? 0 };
}
