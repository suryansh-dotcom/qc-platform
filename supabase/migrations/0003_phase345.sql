-- ============================================================================
-- PHASES 3-5 :: reports storage, reference reconciliation batches
-- ============================================================================

-- Heavy weekly analytical payloads are written here and emailed as links.
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

create policy "managers read reports" on storage.objects for select to authenticated
  using (bucket_id = 'reports' and public.is_admin_or_super());

-- Tracks each uploaded reference sheet for the reconciliation engine.
create table if not exists public.reference_batches (
  id            uuid primary key default gen_random_uuid(),
  uploaded_by   uuid references public.users(id) on delete set null,
  team_id       uuid references public.teams(id) on delete set null,
  row_count     integer not null default 0,
  matched       integer not null default 0,
  mismatched    integer not null default 0,
  unverified    integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.reference_batches enable row level security;

drop policy if exists refbatch_select_managers on public.reference_batches;
create policy refbatch_select_managers on public.reference_batches for select to authenticated
  using (public.is_admin_or_super());
drop policy if exists refbatch_insert_managers on public.reference_batches;
create policy refbatch_insert_managers on public.reference_batches for insert to authenticated
  with check (public.is_admin_or_super());

grant select, insert on public.reference_batches to authenticated;

-- Stamp which batch last touched a daily entry during reconciliation.
alter table public.daily_entries add column if not exists reference_batch_id uuid
  references public.reference_batches(id) on delete set null;
