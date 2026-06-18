-- ============================================================================
-- QC TEAM PLATFORM :: PHASE 0 :: STRUCTURAL FOUNDATIONS
-- Postgres / Supabase initialization migration.
-- All timestamps persist in UTC (timestamptz). Display conversion to IST is a
-- presentation-layer concern handled by the application.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- 1. ENUMERATED TYPES
-- ----------------------------------------------------------------------------
do $$ begin create type app_role as enum ('super_admin','admin','associate'); exception when duplicate_object then null; end $$;
do $$ begin create type leave_status as enum ('pending','approved','rejected','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type leave_day_type as enum ('full','half_first','half_second'); exception when duplicate_object then null; end $$;
do $$ begin create type profile_request_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type verification_status as enum ('unverified','verified','mismatch','admin_override'); exception when duplicate_object then null; end $$;
do $$ begin create type benchmark_calc_type as enum ('absolute','tenure_adjusted','dynamic_stddev'); exception when duplicate_object then null; end $$;
do $$ begin create type email_status as enum ('queued','retrying','sent','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type ai_eval_status as enum ('ok','skipped','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type eval_period_type as enum ('daily','weekly'); exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. CORE TABLES
-- ----------------------------------------------------------------------------

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.users (
  id                          uuid primary key references auth.users(id) on delete cascade,
  team_id                     uuid references public.teams(id) on delete set null,
  full_name                   text not null default '',
  email                       text not null unique,
  role                        app_role not null default 'associate',
  is_leave_approver           boolean not null default false,
  is_backup_leave_approver    boolean not null default false,
  has_associate_history       boolean not null default false,
  districts_count             integer not null default 0 check (districts_count >= 0),
  phone                       text,
  avatar_url                  text,
  join_date                   date not null default current_date,
  leave_balance               numeric(5,1) not null default 0 check (leave_balance >= 0),
  is_active                   boolean not null default true,
  version                     integer not null default 1,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  start_date        date not null,
  end_date          date not null,
  day_type          leave_day_type not null default 'full',
  days_count        numeric(5,1) not null check (days_count > 0),
  reason            text,
  status            leave_status not null default 'pending',
  approver_id       uuid references public.users(id) on delete set null,
  decided_at        timestamptz,
  rejection_reason  text,
  version           integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.daily_entries (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  team_id               uuid references public.teams(id) on delete set null,
  entry_date            date not null,
  unique_reviewed       integer not null default 0 check (unique_reviewed >= 0),
  rework_reviews        integer not null default 0 check (rework_reviews >= 0),
  items_passed          integer not null default 0 check (items_passed >= 0),
  items_failed          integer not null default 0 check (items_failed >= 0),
  hours_worked          numeric(4,2) not null default 0 check (hours_worked >= 0 and hours_worked <= 24),
  defect_category_tags  text[] not null default '{}',
  plan_for_today        text,
  plan_for_tomorrow     text,
  is_locked             boolean not null default false,
  locked_at             timestamptz,
  verification_status   verification_status not null default 'unverified',
  admin_override        boolean not null default false,
  reference_value       jsonb,
  version               integer not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table if not exists public.daily_attachments (
  id              uuid primary key default gen_random_uuid(),
  daily_entry_id  uuid not null references public.daily_entries(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  mime_type       text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  created_at      timestamptz not null default now()
);

create table if not exists public.feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.users(id) on delete set null,
  category        text not null,
  body            text not null,
  is_anonymous    boolean not null default false,
  submitted_date  date not null default current_date,
  created_at      timestamptz,
  check ( (is_anonymous and user_id is null and created_at is null)
       or (not is_anonymous and user_id is not null) )
);

create table if not exists public.benchmarks (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid references public.teams(id) on delete cascade,
  name              text not null,
  calculation_type  benchmark_calc_type not null,
  config            jsonb not null default '{}'::jsonb,
  is_active         boolean not null default true,
  created_by        uuid references public.users(id) on delete set null,
  version           integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.performance_evals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  team_id         uuid references public.teams(id) on delete set null,
  period_type     eval_period_type not null,
  period_start    date not null,
  period_end      date not null,
  raw_metrics     jsonb not null default '{}'::jsonb,
  score           numeric(8,3),
  team_rank       integer,
  ai_status       ai_eval_status not null default 'skipped',
  ai_analysis     jsonb,
  systemic_alerts jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  unique (user_id, period_type, period_start, period_end)
);

create table if not exists public.email_log (
  id            uuid primary key default gen_random_uuid(),
  email_type    text not null,
  recipients    text[] not null default '{}',
  subject       text,
  status        email_status not null default 'queued',
  attempts      integer not null default 0,
  last_error    text,
  storage_link  text,
  scheduled_for timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.profile_update_requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  requested_changes jsonb not null,
  status            profile_request_status not null default 'pending',
  decided_by        uuid references public.users(id) on delete set null,
  decided_at        timestamptz,
  rejection_reason  text,
  version           integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references public.users(id) on delete set null,
  target_user_id  uuid references public.users(id) on delete set null,
  action          text not null,
  entity          text not null,
  entity_id       uuid,
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. INDEXES (including the mandated composite indexes)
-- ----------------------------------------------------------------------------
create index if not exists idx_daily_entries_team_date  on public.daily_entries (team_id, entry_date);
create index if not exists idx_daily_entries_user_date   on public.daily_entries (user_id, entry_date);
create index if not exists idx_daily_entries_verification on public.daily_entries (verification_status) where verification_status = 'mismatch';
create index if not exists idx_leave_requests_user        on public.leave_requests (user_id, status);
create index if not exists idx_leave_requests_status      on public.leave_requests (status) where status = 'pending';
create index if not exists idx_attachments_entry          on public.daily_attachments (daily_entry_id);
create index if not exists idx_perf_evals_user_period     on public.performance_evals (user_id, period_type, period_end);
create index if not exists idx_perf_evals_team_period     on public.performance_evals (team_id, period_type, period_end);
create index if not exists idx_pur_status                 on public.profile_update_requests (status) where status = 'pending';
create index if not exists idx_pur_user                   on public.profile_update_requests (user_id);
create index if not exists idx_email_log_status           on public.email_log (status, scheduled_for);
create index if not exists idx_audit_target               on public.audit_log (target_user_id, created_at);
create index if not exists idx_users_team                 on public.users (team_id);

-- ----------------------------------------------------------------------------
-- 4. SECURITY-DEFINER HELPER FUNCTIONS
--    These read role state without invoking RLS, preventing recursive policy
--    evaluation on public.users.
-- ----------------------------------------------------------------------------
create or replace function public.auth_role()
returns app_role
language sql stable security definer set search_path = public
as $$ select role from public.users where id = auth.uid() $$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'super_admin' from public.users where id = auth.uid()), false) $$;

create or replace function public.is_admin_or_super()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role in ('admin','super_admin') from public.users where id = auth.uid()), false) $$;

create or replace function public.can_approve_leave()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select role in ('admin','super_admin') or is_leave_approver or is_backup_leave_approver
    from public.users where id = auth.uid()
  ), false)
$$;

grant execute on function public.auth_role(), public.is_super_admin(), public.is_admin_or_super(), public.can_approve_leave() to authenticated;

-- ----------------------------------------------------------------------------
-- 5. MUTATION TRIGGERS (updated_at maintenance + optimistic version stamping)
-- ----------------------------------------------------------------------------
create or replace function public.tg_set_versioned()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;
  return new;
end; $$;

create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_users_versioned on public.users;
create trigger trg_users_versioned before update on public.users
  for each row execute function public.tg_set_versioned();

drop trigger if exists trg_leave_versioned on public.leave_requests;
create trigger trg_leave_versioned before update on public.leave_requests
  for each row execute function public.tg_set_versioned();

drop trigger if exists trg_entries_versioned on public.daily_entries;
create trigger trg_entries_versioned before update on public.daily_entries
  for each row execute function public.tg_set_versioned();

drop trigger if exists trg_benchmarks_versioned on public.benchmarks;
create trigger trg_benchmarks_versioned before update on public.benchmarks
  for each row execute function public.tg_set_versioned();

drop trigger if exists trg_pur_versioned on public.profile_update_requests;
create trigger trg_pur_versioned before update on public.profile_update_requests
  for each row execute function public.tg_set_versioned();

drop trigger if exists trg_email_touch on public.email_log;
create trigger trg_email_touch before update on public.email_log
  for each row execute function public.tg_touch_updated_at();

drop trigger if exists trg_settings_touch on public.settings;
create trigger trg_settings_touch before update on public.settings
  for each row execute function public.tg_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 6. AUTH SYNCHRONIZATION TRIGGER
--    On auth registration, materialize a public.users profile. Role, team,
--    district load, and approver flags are provisioned from the roster stored
--    in settings ('roster_provisioning'), keyed by lowercased full name.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_roster jsonb;
  v_entry  jsonb;
  v_name   text;
  v_team   uuid;
begin
  v_name := lower(trim(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1))));
  select value into v_roster from public.settings where key = 'roster_provisioning';
  select id into v_team from public.teams order by created_at limit 1;
  v_entry := coalesce(v_roster -> v_name, '{}'::jsonb);

  insert into public.users (
    id, email, full_name, role, team_id, districts_count,
    is_leave_approver, is_backup_leave_approver, join_date, leave_balance
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', initcap(replace(v_name,'.',' '))),
    coalesce((v_entry->>'role')::app_role, 'associate'),
    v_team,
    coalesce((v_entry->>'districts')::integer, 0),
    coalesce((v_entry->>'is_leave_approver')::boolean, false),
    coalesce((v_entry->>'is_backup_leave_approver')::boolean, false),
    current_date,
    coalesce((v_entry->>'leave_balance')::numeric, 0)
  )
  on conflict (id) do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 7. REMOTE PROCEDURE CALLS
-- ----------------------------------------------------------------------------

-- Anonymous feedback writer. SECURITY DEFINER bypasses the feedback INSERT
-- policy. Stores a fresh random UUID and a date-only stamp, records no user_id
-- and no precise timestamp, so no time-correlation linkage is persisted.
create or replace function public.submit_anonymous_feedback(p_category text, p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_category is null or length(trim(p_category)) = 0 then
    raise exception 'category is required';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'body is required';
  end if;

  insert into public.feedback (id, user_id, category, body, is_anonymous, submitted_date, created_at)
  values (gen_random_uuid(), null, p_category, p_body, true, current_date, null);
end; $$;

-- Identified feedback writer. Binds the row to the calling associate.
create or replace function public.submit_identified_feedback(p_category text, p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  insert into public.feedback (id, user_id, category, body, is_anonymous, submitted_date, created_at)
  values (gen_random_uuid(), auth.uid(), p_category, p_body, false, current_date, now());
end; $$;

revoke all on function public.submit_anonymous_feedback(text, text) from public;
revoke all on function public.submit_identified_feedback(text, text) from public;
grant execute on function public.submit_anonymous_feedback(text, text) to authenticated;
grant execute on function public.submit_identified_feedback(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. ROW-LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.teams                   enable row level security;
alter table public.users                   enable row level security;
alter table public.leave_requests          enable row level security;
alter table public.daily_entries           enable row level security;
alter table public.daily_attachments       enable row level security;
alter table public.feedback                enable row level security;
alter table public.benchmarks              enable row level security;
alter table public.performance_evals       enable row level security;
alter table public.email_log               enable row level security;
alter table public.settings                enable row level security;
alter table public.profile_update_requests enable row level security;
alter table public.audit_log               enable row level security;

-- teams
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated using (true);
drop policy if exists teams_write on public.teams;
create policy teams_write on public.teams for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- users
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users for select to authenticated
  using (id = auth.uid());
drop policy if exists users_select_managers on public.users;
create policy users_select_managers on public.users for select to authenticated
  using (public.is_admin_or_super());
drop policy if exists users_update_managers on public.users;
create policy users_update_managers on public.users for update to authenticated
  using (public.is_admin_or_super()) with check (public.is_admin_or_super());

-- leave_requests
drop policy if exists leave_select_own on public.leave_requests;
create policy leave_select_own on public.leave_requests for select to authenticated
  using (user_id = auth.uid());
drop policy if exists leave_insert_own on public.leave_requests;
create policy leave_insert_own on public.leave_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists leave_update_own_pending on public.leave_requests;
create policy leave_update_own_pending on public.leave_requests for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status in ('pending','cancelled'));
drop policy if exists leave_select_approvers on public.leave_requests;
create policy leave_select_approvers on public.leave_requests for select to authenticated
  using (public.can_approve_leave());
drop policy if exists leave_update_approvers on public.leave_requests;
create policy leave_update_approvers on public.leave_requests for update to authenticated
  using (public.can_approve_leave()) with check (public.can_approve_leave());

-- daily_entries
drop policy if exists entries_select_own on public.daily_entries;
create policy entries_select_own on public.daily_entries for select to authenticated
  using (user_id = auth.uid());
drop policy if exists entries_insert_own on public.daily_entries;
create policy entries_insert_own on public.daily_entries for insert to authenticated
  with check (user_id = auth.uid() and is_locked = false);
drop policy if exists entries_update_own_unlocked on public.daily_entries;
create policy entries_update_own_unlocked on public.daily_entries for update to authenticated
  using (user_id = auth.uid() and is_locked = false)
  with check (user_id = auth.uid());
drop policy if exists entries_select_managers on public.daily_entries;
create policy entries_select_managers on public.daily_entries for select to authenticated
  using (public.is_admin_or_super());
drop policy if exists entries_update_managers on public.daily_entries;
create policy entries_update_managers on public.daily_entries for update to authenticated
  using (public.is_admin_or_super()) with check (public.is_admin_or_super());

-- daily_attachments
drop policy if exists attach_select_own on public.daily_attachments;
create policy attach_select_own on public.daily_attachments for select to authenticated
  using (user_id = auth.uid());
drop policy if exists attach_insert_own on public.daily_attachments;
create policy attach_insert_own on public.daily_attachments for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists attach_delete_own on public.daily_attachments;
create policy attach_delete_own on public.daily_attachments for delete to authenticated
  using (user_id = auth.uid());
drop policy if exists attach_select_managers on public.daily_attachments;
create policy attach_select_managers on public.daily_attachments for select to authenticated
  using (public.is_admin_or_super());

-- feedback :: read restricted to Super-Admins only; identified inserts bound to self.
drop policy if exists feedback_select_super on public.feedback;
create policy feedback_select_super on public.feedback for select to authenticated
  using (public.is_super_admin());
drop policy if exists feedback_insert_identified on public.feedback;
create policy feedback_insert_identified on public.feedback for insert to authenticated
  with check (is_anonymous = false and user_id = auth.uid());

-- benchmarks
drop policy if exists benchmarks_select on public.benchmarks;
create policy benchmarks_select on public.benchmarks for select to authenticated
  using (public.is_admin_or_super()
         or (is_active and team_id = (select team_id from public.users where id = auth.uid())));
drop policy if exists benchmarks_write on public.benchmarks;
create policy benchmarks_write on public.benchmarks for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- performance_evals :: self-redaction enforced — managers may not read rows
-- targeting their own identifier; associates read only their own.
drop policy if exists perf_select_own_associate on public.performance_evals;
create policy perf_select_own_associate on public.performance_evals for select to authenticated
  using (public.auth_role() = 'associate' and user_id = auth.uid());
drop policy if exists perf_select_managers on public.performance_evals;
create policy perf_select_managers on public.performance_evals for select to authenticated
  using (public.is_admin_or_super() and user_id <> auth.uid());

-- email_log
drop policy if exists email_select_managers on public.email_log;
create policy email_select_managers on public.email_log for select to authenticated
  using (public.is_admin_or_super());

-- settings
drop policy if exists settings_select_managers on public.settings;
create policy settings_select_managers on public.settings for select to authenticated
  using (public.is_admin_or_super());
drop policy if exists settings_write_super on public.settings;
create policy settings_write_super on public.settings for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- profile_update_requests
drop policy if exists pur_select_own on public.profile_update_requests;
create policy pur_select_own on public.profile_update_requests for select to authenticated
  using (user_id = auth.uid());
drop policy if exists pur_insert_own on public.profile_update_requests;
create policy pur_insert_own on public.profile_update_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists pur_select_managers on public.profile_update_requests;
create policy pur_select_managers on public.profile_update_requests for select to authenticated
  using (public.is_admin_or_super());
drop policy if exists pur_update_managers on public.profile_update_requests;
create policy pur_update_managers on public.profile_update_requests for update to authenticated
  using (public.is_admin_or_super()) with check (public.is_admin_or_super());

-- audit_log :: managers read all except entries targeting their own identifier.
drop policy if exists audit_select_managers on public.audit_log;
create policy audit_select_managers on public.audit_log for select to authenticated
  using (public.is_admin_or_super() and (target_user_id is null or target_user_id <> auth.uid()));

-- ----------------------------------------------------------------------------
-- 9. TABLE GRANTS (privileges gated further by the RLS policies above)
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.teams                   to authenticated;
grant select, insert, update, delete on public.users                   to authenticated;
grant select, insert, update, delete on public.leave_requests          to authenticated;
grant select, insert, update, delete on public.daily_entries           to authenticated;
grant select, insert, update, delete on public.daily_attachments       to authenticated;
grant select, insert                 on public.feedback                to authenticated;
grant select, insert, update, delete on public.benchmarks              to authenticated;
grant select                          on public.performance_evals       to authenticated;
grant select                          on public.email_log               to authenticated;
grant select, insert, update, delete on public.settings                to authenticated;
grant select, insert, update, delete on public.profile_update_requests to authenticated;
grant select                          on public.audit_log               to authenticated;

-- ----------------------------------------------------------------------------
-- 10. SEED DATA
-- ----------------------------------------------------------------------------
insert into public.teams (name)
values ('Quality Control')
on conflict (name) do nothing;

insert into public.settings (key, value) values
('timezone', '{"system":"Asia/Kolkata","storage":"UTC"}'::jsonb),
('report_recipients', '{"daily":["Suryansh Shukla","Prajwal Repale"],"weekly":["Suryansh Shukla","Nihar Desai","Prajwal Repale"]}'::jsonb),
('leave_approval', '{"primary":"Prajwal Repale","backup":"Suryansh Shukla"}'::jsonb),
('lock_window', '{"close_at_ist":"23:59","buffer_hours":24}'::jsonb),
('cron_schedule_ist', '{"daily_snapshot":"17:00","weekly_summary":{"day":"friday","time":"17:30"}}'::jsonb),
('roster_provisioning', '{
  "suryansh shukla":      {"role":"super_admin","is_backup_leave_approver":true},
  "nihar desai":          {"role":"super_admin"},
  "prajwal repale":       {"role":"admin","is_leave_approver":true},
  "akash dey":            {"role":"associate","districts":18},
  "moumita saha":         {"role":"associate","districts":16},
  "nayaz shaik":          {"role":"associate","districts":12},
  "rajnee singh":         {"role":"associate","districts":8},
  "bulbul priyadarshini": {"role":"associate","districts":8},
  "vishal verma":         {"role":"associate","districts":7},
  "sheetal ahirwar":      {"role":"associate","districts":7},
  "ankit chamoli":        {"role":"associate","districts":6},
  "anjalee kumari":       {"role":"associate","districts":4},
  "chaitanya hemanth":    {"role":"associate","districts":3},
  "adithya eadara":       {"role":"associate","districts":3}
}'::jsonb)
on conflict (key) do nothing;
