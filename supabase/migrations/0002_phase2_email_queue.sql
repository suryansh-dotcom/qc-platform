-- ============================================================================
-- PHASE 2 :: EMAIL QUEUE EXTENSION
-- Adds the render/queue columns the async SMTP engine drains in chunks.
-- ============================================================================
alter table public.email_log add column if not exists template     text;
alter table public.email_log add column if not exists payload       jsonb not null default '{}'::jsonb;
alter table public.email_log add column if not exists max_attempts  integer not null default 5;

alter table public.email_log alter column scheduled_for set default now();

create index if not exists idx_email_log_drain
  on public.email_log (scheduled_for)
  where status in ('queued','retrying');
