import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { buildWeeklySummary, resolveRecipients } from "@/lib/reports";
import { enqueueEmail, processEmailQueue } from "@/actions/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsvRow } from "@/lib/csv";
import { istDateKey, nowIST } from "@/lib/dates";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();

  const toKey = istDateKey(nowIST());
  const fromKey = istDateKey(subDays(nowIST(), 6));
  const summary = await buildWeeklySummary(fromKey, toKey);

  const header = ["rank", "name", "unique", "rework", "passRate", "defectRate", "hours", "score"];
  const csv = [toCsvRow(header), ...summary.rows.map((r) =>
    toCsvRow([r.rank, r.name, r.unique, r.rework, r.passRate, r.defectRate, r.hours, r.score])
  )].join("\n");
  const path = `weekly/${toKey}_summary.csv`;
  await admin.storage.from("reports").upload(path, new Blob([csv], { type: "text/csv" }), { upsert: true });
  const { data: signed } = await admin.storage.from("reports").createSignedUrl(path, 60 * 60 * 24 * 7);

  const recipients = await resolveRecipients("weekly");
  await enqueueEmail({
    template: "weekly_report",
    recipients,
    payload: {
      fromKey, toKey, link: signed?.signedUrl ?? "",
      top: summary.rows.slice(0, 3),
      feedbackLine: `Feedback submissions this week: ${summary.feedbackCount}`,
    },
  });
  const drain = await processEmailQueue(10);
  return NextResponse.json({ ok: true, fromKey, toKey, ranked: summary.rows.length, path, ...drain });
}

// Vercel Cron always invokes via GET; Supabase pg_cron/pg_net uses POST.
export async function GET(request: Request) {
  return POST(request);
}
