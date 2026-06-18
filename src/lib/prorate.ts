// Pro-rating for partial-day approved leave.
// Spec: on days with active partial-day approved leave, pro-rate target
// throughput using real operational windows (Hours Worked / Expected Hours).
//
// leaveFraction is the share of the day on approved leave: 0 (none),
// 0.5 (half day), or 1 (full day). Expected allocation for the day scales by
// the remaining working fraction.

export const STANDARD_DAY_HOURS = 8;

export type DayProration = {
  date: string;
  leaveFraction: number;       // 0, 0.5, 1
  expectedHours: number;       // standard hours * working fraction
  proratedTarget: number;      // base daily target * working fraction
  attainment: number | null;   // hoursWorked / expectedHours (null if no expected window)
};

export function prorateDay(
  date: string,
  baseDailyTarget: number,
  leaveFraction: number,
  hoursWorked: number,
  standardDayHours: number = STANDARD_DAY_HOURS
): DayProration {
  const clamped = Math.max(0, Math.min(1, leaveFraction));
  const workingFraction = 1 - clamped;
  const expectedHours = Math.round(standardDayHours * workingFraction * 100) / 100;
  const proratedTarget = Math.round(baseDailyTarget * workingFraction * 100) / 100;
  const attainment =
    expectedHours > 0 ? Math.round((hoursWorked / expectedHours) * 1000) / 1000 : null;
  return { date, leaveFraction: clamped, expectedHours, proratedTarget, attainment };
}

// Map an approved leave row to per-date fractions across its span.
export function leaveFractionsForRange(
  leaves: Array<{ start_date: string; end_date: string; day_type: "full" | "half_first" | "half_second" }>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of leaves) {
    let d = new Date(l.start_date + "T00:00:00");
    const end = new Date(l.end_date + "T00:00:00");
    const isHalf = l.day_type !== "full";
    while (d <= end) {
      const key = d.toISOString().slice(0, 10);
      // A half-day applies only to a single-day request boundary; multi-day
      // spans treat interior days as full and apply the half to the edge.
      const isEdge = l.start_date === key || l.end_date === key;
      out[key] = Math.max(out[key] ?? 0, isHalf && isEdge ? 0.5 : 1);
      d = new Date(d.getTime() + 86400000);
    }
  }
  return out;
}
