import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { buildDailySnapshot, resolveRecipients } from "@/lib/reports";
import { enqueueEmail, processEmailQueue } from "@/actions/email";
import { istDateKey, nowIST } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = istDateKey(nowIST());
  const snapshot = await buildDailySnapshot(date);
  const recipients = await resolveRecipients("daily");
  if (recipients.length === 0) return NextResponse.json({ ok: false, error: "No recipients resolved" });

  await enqueueEmail({
    template: "daily_report",
    recipients,
    payload: { date: snapshot.date, rows: snapshot.members },
  });
  const drain = await processEmailQueue(10);
  return NextResponse.json({ ok: true, date, members: snapshot.members.length, ...drain });
}

// Vercel Cron always invokes via GET; Supabase pg_cron/pg_net uses POST.
export async function GET(request: Request) {
  return POST(request);
}
