import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmail } from "@/lib/email-templates";
import { sendWithRetry } from "@/lib/mailer";

// Enqueue a single email row. Render happens at send time from template+payload.
export async function enqueueEmail(input: {
  template: string;
  recipients: string[];
  payload: Record<string, unknown>;
  scheduledFor?: string;
}) {
  const admin = createAdminClient();
  const { subject } = renderEmail(input.template, input.payload);
  const { error } = await admin.from("email_log").insert({
    email_type: input.template,
    template: input.template,
    recipients: input.recipients,
    subject,
    payload: input.payload,
    status: "queued",
    scheduled_for: input.scheduledFor ?? new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

// Drain due rows in a bounded chunk (~10) to stay under serverless timeouts.
// Used inline after enqueue (best-effort) and by the cron worker.
export async function processEmailQueue(limit = 10): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: rows } = await admin
    .from("email_log")
    .select("id, template, recipients, payload, attempts, max_attempts")
    .in("status", ["queued", "retrying"])
    .lte("scheduled_for", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  let sent = 0;
  let failed = 0;
  const from = process.env.SMTP_USER;

  for (const row of rows ?? []) {
    try {
      const { subject, html, text } = renderEmail(row.template, row.payload as Record<string, any>);
      await sendWithRetry({ from, to: row.recipients, subject, html, text });
      await admin
        .from("email_log")
        .update({ status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1 })
        .eq("id", row.id);
      sent += 1;
    } catch (err) {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= row.max_attempts;
      const backoffMin = Math.min(2 ** attempts, 60);
      await admin
        .from("email_log")
        .update({
          status: exhausted ? "failed" : "retrying",
          attempts,
          last_error: err instanceof Error ? err.message : String(err),
          scheduled_for: new Date(Date.now() + backoffMin * 60000).toISOString(),
        })
        .eq("id", row.id);
      failed += 1;
    }
  }
  return { sent, failed };
}
