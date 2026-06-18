// Deterministic qualitative signals computed from entries. These are the
// raw-math fallback when the AI engine is unavailable, and also the input
// context handed to the AI engine when it is available.

type Entry = {
  entry_date: string;
  unique_reviewed: number;
  plan_for_today: string | null;
  plan_for_tomorrow: string | null;
  defect_category_tags: string[];
};

export function jaccard(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (ta.size === 0 && tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter += 1; });
  return inter / (ta.size + tb.size - inter);
}

export function consecutiveRollovers(entries: Entry[]): number {
  // Tomorrow's plan reappearing as the next day's plan implies a rollover.
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  let run = 0;
  let max = 0;
  for (let i = 1; i < sorted.length; i++) {
    const carried = sorted[i - 1].plan_for_tomorrow ?? "";
    const today = sorted[i].plan_for_today ?? "";
    if (carried && jaccard(carried, today) > 0.6) { run += 1; max = Math.max(max, run); }
    else run = 0;
  }
  return max;
}

export function repetitivePlanRatio(entries: Entry[]): number {
  const plans = entries.map((e) => e.plan_for_today ?? "").filter(Boolean);
  if (plans.length < 2) return 0;
  let repeats = 0;
  for (let i = 1; i < plans.length; i++) {
    if (jaccard(plans[i - 1], plans[i]) > 0.75) repeats += 1;
  }
  return Math.round((repeats / (plans.length - 1)) * 100) / 100;
}

export function rawScore(metrics: {
  unique: number; passRate: number; defectRate: number; target: number;
}): number {
  const attainment = metrics.target > 0 ? metrics.unique / metrics.target : 0;
  // Weighted: 60% attainment, 40% quality (pass rate), penalize defects lightly.
  const score = 0.6 * Math.min(1.5, attainment) + 0.4 * (metrics.passRate / 100);
  return Math.round(score * 1000) / 1000;
}
