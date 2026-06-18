"use client";
import { useMemo } from "react";
import {
  eachDayOfInterval, endOfMonth, format, isWeekend, startOfMonth,
} from "date-fns";
import { istDateKey, isPastLockWindow, nowIST } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Status = "green" | "red" | "gray" | "blue" | "off";

export function StatusCalendar({
  submittedDates, leaveDates, month,
}: {
  submittedDates: string[];
  leaveDates: string[];
  month?: Date;
}) {
  const base = month ?? nowIST();
  const submitted = useMemo(() => new Set(submittedDates), [submittedDates]);
  const leave = useMemo(() => new Set(leaveDates), [leaveDates]);

  const days = eachDayOfInterval({ start: startOfMonth(base), end: endOfMonth(base) });
  const todayKey = istDateKey(nowIST());

  function statusFor(d: Date): Status {
    const key = istDateKey(d);
    if (leave.has(key)) return "blue";
    if (isWeekend(d)) return "off";
    if (submitted.has(key)) return "green";
    if (key > todayKey) return "off";
    if (!isPastLockWindow(key)) return "gray"; // current day or within 24h buffer
    return "red"; // working day missed and now locked
  }

  const swatch: Record<Status, string> = {
    green: "bg-status-green text-white",
    red: "bg-status-red text-white",
    gray: "bg-status-gray text-white",
    blue: "bg-status-blue text-white",
    off: "bg-slate-100 text-slate-400",
  };

  const leadBlanks = startOfMonth(base).getDay();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{format(base, "MMMM yyyy")}</span>
        <div className="flex gap-3 text-[11px] text-slate-500">
          <Legend cls="bg-status-green" label="Submitted" />
          <Legend cls="bg-status-gray" label="Pending" />
          <Legend cls="bg-status-red" label="Missed" />
          <Legend cls="bg-status-blue" label="Leave" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-slate-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadBlanks }).map((_, i) => <div key={`b${i}`} />)}
        {days.map((d) => {
          const s = statusFor(d);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-xs",
                swatch[s]
              )}
              title={`${istDateKey(d)} — ${s}`}
            >
              {format(d, "d")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", cls)} />
      {label}
    </span>
  );
}
