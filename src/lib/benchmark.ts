// Flexible benchmark target computation. A benchmark row carries a
// calculation_type and a JSON config; this resolves the per-day target for a
// user, then pro-rating is applied separately for partial-day leave.

import { prorateDay } from "@/lib/prorate";

export type BenchmarkConfig =
  | { type: "absolute"; target: number }
  | { type: "tenure_adjusted"; target: number; graceDays: number; floorRatio?: number }
  | { type: "dynamic_stddev"; k?: number };

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Returns the base (pre-proration) daily target.
export function baseTarget(
  config: BenchmarkConfig,
  ctx: { joinDate: string; asOf: string; trailingGroupThroughput: number[] }
): number {
  if (config.type === "absolute") return config.target;

  if (config.type === "tenure_adjusted") {
    const join = new Date(ctx.joinDate + "T00:00:00").getTime();
    const asOf = new Date(ctx.asOf + "T00:00:00").getTime();
    const daysSince = Math.max(0, Math.floor((asOf - join) / 86400000));
    const ramp = Math.min(1, config.graceDays > 0 ? daysSince / config.graceDays : 1);
    const floor = config.floorRatio ?? 0.5;
    return Math.round(config.target * Math.max(floor, ramp) * 100) / 100;
  }

  // dynamic_stddev: trailing 7-day group median minus k standard deviations.
  const med = median(ctx.trailingGroupThroughput);
  const sd = stddev(ctx.trailingGroupThroughput);
  const k = config.k ?? 1;
  return Math.max(0, Math.round((med - k * sd) * 100) / 100);
}

export function dailyTargetWithProration(args: {
  config: BenchmarkConfig;
  joinDate: string;
  date: string;
  leaveFraction: number;
  hoursWorked: number;
  trailingGroupThroughput: number[];
}) {
  const base = baseTarget(args.config, {
    joinDate: args.joinDate,
    asOf: args.date,
    trailingGroupThroughput: args.trailingGroupThroughput,
  });
  return prorateDay(args.date, base, args.leaveFraction, args.hoursWorked);
}
