import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { addDays, eachDayOfInterval, isWeekend, parseISO } from "date-fns";

export const IST = process.env.NEXT_PUBLIC_TZ || "Asia/Kolkata";

export function nowIST(): Date {
  return toZonedTime(new Date(), IST);
}

export function istDateKey(d: Date | string): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return formatInTimeZone(date, IST, "yyyy-MM-dd");
}

export function fmtIST(d: Date | string, pattern = "dd MMM yyyy, HH:mm"): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return formatInTimeZone(date, IST, pattern);
}

// The rolling 24h edit window closes at 23:59 IST on day X+1.
export function isPastLockWindow(entryDateKey: string): boolean {
  const entry = parseISO(entryDateKey + "T00:00:00");
  const lockMomentIST = new Date(addDays(entry, 1));
  lockMomentIST.setHours(23, 59, 0, 0);
  return nowIST().getTime() > lockMomentIST.getTime();
}

// Count leave days, skipping weekends and supplied holidays, honoring half-days.
export function countLeaveDays(
  startKey: string,
  endKey: string,
  dayType: "full" | "half_first" | "half_second",
  holidays: string[] = []
): number {
  const start = parseISO(startKey + "T00:00:00");
  const end = parseISO(endKey + "T00:00:00");
  const holidaySet = new Set(holidays);
  const days = eachDayOfInterval({ start, end }).filter(
    (d) => !isWeekend(d) && !holidaySet.has(istDateKey(d))
  );
  let total = days.length;
  if (dayType !== "full" && total >= 1) total -= 0.5;
  return total;
}
