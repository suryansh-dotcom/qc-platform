# QC Platform — Deployment Guide

This repository currently contains **Phase 0** (database) and **Phase 1** (the
associate 4-tab app) plus the **admin / super-admin edit-anything console** and
authentication. Phases 2–5 (leave email routing, executive reconciliation,
cron/Edge-Function reports, AI engine) build on top of this and are not yet wired.

## 0. Prerequisites
- Node.js 18.18+ (or 20+)
- A Supabase project (free tier is fine to start)
- A Gmail account with a 16-character App Password (for the Phase 2/4 email engine)
- A Moonshot API key (for the Phase 5 AI engine)

## 1. Create the Supabase project
1. Go to supabase.com → New project. Note the **project ref**, **region**, and **database password**.
2. Project Settings → API: copy the **Project URL**, **anon key**, and **service_role key**.

## 2. Apply the database migrations
The SQL lives in `supabase/migrations/`. Apply in order.

**Option A — SQL editor (simplest):** open each file and run it in the Supabase SQL editor, in this order:
1. `0000_phase0_init.sql`
2. `0001_admin_override.sql`
3. `0002_phase2_email_queue.sql`

**Option B — Supabase CLI:**
```bash
npm i -g supabase
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## 3. Create the Storage bucket
SQL editor:
```sql
insert into storage.buckets (id, name, public) values ('daily-attachments','daily-attachments', false);
```
Then add policies so users read/write only their own folder:
```sql
create policy "own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'daily-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder write" on storage.objects for insert to authenticated
  with check (bucket_id = 'daily-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "managers read attachments" on storage.objects for select to authenticated
  using (bucket_id = 'daily-attachments' and public.is_admin_or_super());
```

Also create the private **reports** bucket used by the weekly summary:
```sql
insert into storage.buckets (id, name, public) values ('reports','reports', false);
```
The weekly job writes JSON payloads here and emails a 7-day signed link (a
super-admin variant with feedback stats, and a feedback-free admin variant).

## 4. Configure Auth
- Authentication → Providers → Email: enable. Turn **on** "Email OTP".
- Authentication → Email Templates → Magic Link: ensure the template includes both
  the confirmation link **and** the token, so the 6-digit fallback works. Add a line like:
  `Your code: {{ .Token }}`
- Authentication → URL Configuration → Site URL: set to your deployed URL.
- Add your local `http://localhost:3000` to Redirect URLs for development.

## 5. Provision the roster
Users are auto-provisioned on first sign-in by the `handle_new_user` trigger,
which reads the `roster_provisioning` row in `settings` (seeded by Phase 0),
keyed by **lowercased full name**. To make this reliable, set each person's
`full_name` in their auth metadata at invite time, e.g.:
```sql
-- after a user first signs in you can also correct roles directly:
update public.users set role = 'super_admin' where email = 'suryansh@...';
```
If you prefer email-keyed provisioning, tell me your email convention and I'll
switch the trigger over.

## 6. Environment variables
Copy `.env.example` to `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server only
DATABASE_URL=...                     # Supavisor pooler host, port 6543
NEXT_PUBLIC_SITE_URL=...
NEXT_PUBLIC_TZ=Asia/Kolkata
```
**Supavisor:** any direct Postgres connection (Edge Functions, cron, scripts in
later phases) must use the pooler host
`aws-0-REGION.pooler.supabase.com` (port `6543`, transaction mode), never the
direct `db.<ref>.supabase.co:5432` host. The Next.js app itself talks to
Supabase over PostgREST, which is already pooled.

## 6b. SMTP (Gmail App Password) — Phase 2 email engine
1. In your Google Account → Security, enable 2-Step Verification, then create a
   16-character **App Password**.
2. Set in `.env.local` / Vercel:
   `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=your@gmail.com`,
   `SMTP_PASS=<the 16-char app password>`.
3. Set a long random `CRON_SECRET`.

The email engine never puts action links in messages: a leave request emails the
primary approver a link to `/leave/<id>`, which requires login and records the
decision via an explicit POST. Sends are enqueued to `email_log` and drained in
chunks of 10 with exponential backoff + jitter.

## 6c. Drain the email queue on a schedule
`POST /api/email/process` with header `x-cron-secret: <CRON_SECRET>` drains due
emails. Wire it to a schedule (Phase 4 will also use pg_cron). Quick options:
- **Vercel Cron** (`vercel.json`):
  ```json
  { "crons": [{ "path": "/api/email/process", "schedule": "*/2 * * * *" }] }
  ```
  (add the secret via a rewrite/middleware or call from a Supabase cron instead)
- **Supabase pg_cron + pg_net** calling the endpoint every couple of minutes with
  the secret header. Enqueue also triggers a best-effort inline send, so most mail
  goes out immediately; the cron is the retry safety net.

## 6d. Reports bucket & full cron schedule (Phases 3-5)
Migration `0003` creates the private `reports` storage bucket used for weekly
payloads. The full schedule (UTC; IST = UTC+5:30) is in `vercel.json`:

| Job | Route | IST | UTC cron |
|-----|-------|-----|----------|
| Email drain | `/api/email/process` | every 2 min | `*/2 * * * *` |
| Lock windows | `/api/cron/lock` | 23:59 daily | `29 18 * * *` |
| Daily snapshot | `/api/cron/daily-report` | 17:00 daily | `30 11 * * *` |
| AI review | `/api/cron/ai-review` | 17:15 Fri | `45 11 * * 5` |
| Weekly summary | `/api/cron/weekly-report` | 17:30 Fri | `0 12 * * 5` |

Vercel Cron authenticates automatically via `Authorization: Bearer $CRON_SECRET`
(set `CRON_SECRET` in env). On Hobby plans Vercel limits cron frequency/count —
use the **Supabase pg_cron** alternative in `0004_pg_cron_schedule.sql` (uncomment,
substitute your URL + secret, apply). The endpoints also accept an `x-cron-secret`
header for that path. The daily ordering Lock → Validate → Report is preserved by
scheduling `lock` ahead of `daily-report`; reference validation is operator-driven
upload.

## 7. Run locally
```bash
npm install
npm run dev
# http://localhost:3000
```
Associates land on `/daily`; admins and super-admins on `/admin`.

## 8. Deploy to Vercel
1. Push this folder to a Git repo.
2. Import it in Vercel. Framework preset: **Next.js**.
3. Add all variables from step 6 in Project → Settings → Environment Variables.
   Keep `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` as server-only (do not
   prefix with `NEXT_PUBLIC_`).
4. Deploy. Update the Supabase Site URL and Redirect URLs to the Vercel domain.

## 9. Schedule the engine jobs (Phase 4/5)
All routes accept either Vercel Cron (GET + `Authorization: Bearer $CRON_SECRET`)
or Supabase pg_cron (POST + `x-cron-secret`). Times below are **IST converted to UTC**.

| Job | IST | UTC cron | Endpoint |
|-----|-----|----------|----------|
| Email queue drain | every 5 min | `*/5 * * * *` | `/api/email/process` |
| Daily snapshot | 17:00 | `30 11 * * *` | `/api/cron/daily` |
| AI review | Fri 17:15 | `45 11 * * 5` | `/api/cron/ai-review` |
| Weekly summary | Fri 17:30 | `0 12 * * 5` | `/api/cron/weekly` |

A `vercel.json` with these crons is included. On Vercel, set `CRON_SECRET` and
Vercel attaches the Bearer header automatically. The daily job runs in the
mandated order: **lock windows -> sheet validations -> report delivery**.

**Supabase pg_cron alternative** (reliable header-based auth):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('qc-daily','30 11 * * *', $$
  select net.http_post(
    url := 'https://YOUR_APP/api/cron/daily',
    headers := jsonb_build_object('x-cron-secret','YOUR_CRON_SECRET')
  );$$);
-- repeat for weekly (0 12 * * 5), ai-review (45 11 * * 5), email (*/5 * * * *)
```

## 10. Benchmarks & AI engine (Phase 5)
- Super-admins manage targets at `/admin/benchmarks` with three modes:
  **absolute** `{target}`, **tenure_adjusted** `{target,graceDays,graceFactor}`
  (grace by `join_date`), and **dynamic_stddev** `{lookbackDays,k}` (trailing
  group median, with a floor at median − k·σ).
-- Set `MOONSHOT_API_KEY` and optionally `ANTHROPIC_MODEL` (default
  `claude-sonnet-4-6`). The AI worker uses structured tool-use to return strict
  JSON; on any API failure it degrades cleanly to raw-math scoring. Systemic
  alerts (cross-associate defect-tag intersections, task rollover, repetitive
  prose) are computed locally regardless of AI availability.

## What works now
- Magic-link + 6-digit OTP login; role-based routing.
- **Associate (4 tabs):** validated Daily Work Sync with 10MB attachments and the
  green/red/gray/blue status calendar; private trend Dashboard; Profile & Leave with
  the staging gate; Feedback with anonymize RPC and disclaimer.
- **Phase 2 — leave engine:** approver SMTP notification (retry/backoff/jitter),
  login-gated POST approval at `/leave/<id>`, balance deduction, audit, decision email.
- **Phase 3 — executive layer:** Select-Team-gated exec dashboard; CSV reconciliation
  (Verified/Unverified/Mismatch with admin_override freeze); profile verification diff
  queue; cursor-streamed CSV export at `/api/export?table=...` (never buffers the table).
- **Phase 4 — engine jobs:** 24h lock window, validation sweep, daily snapshot (17:00,
  Nudged/Shift-Pending flags) and weekly summary (Fri 17:30, rankings + trends, feedback
  for super-admins only, heavy payload to Storage + signed link).
- **Phase 5 — performance & AI:** three-mode benchmark dashboard; Anthropic tool-use
  worker writing structured `performance_evals` with raw-math fallback and systemic alerts.

All five phases are implemented. Type-checks clean (`npx tsc --noEmit`) and builds
(`next build`) with 19 routes.
