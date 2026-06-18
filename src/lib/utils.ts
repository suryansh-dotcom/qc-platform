export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const DEFECT_CATEGORIES = [
  "Data Accuracy", "Formatting", "Completeness", "Duplicate", "Mislabeled",
  "Out of Scope", "Source Mismatch", "Other",
] as const;

export const FEEDBACK_CATEGORIES = [
  "Process", "Tooling", "Workload", "Management", "Recognition", "Other",
] as const;

export function ratio(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}
