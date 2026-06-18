-- ============================================================================
-- PHASE 1 ADDENDUM :: ADMIN / SUPER-ADMIN "EDIT ANYTHING" GRANTS
-- Super-admins gain full write across every operational table (including
-- feedback, which only they can read). Admins gain full write across all
-- operational tables EXCEPT feedback, preserving the spec's hard boundary that
-- admins have zero feedback access. The self-redaction SELECT restriction on
-- performance_evals and audit_log is intentionally left intact.
-- ============================================================================

-- teams: admins may edit existing team metadata; create/delete stays super-admin.
drop policy if exists teams_update_admin on public.teams;
create policy teams_update_admin on public.teams for update to authenticated
  using (public.is_admin_or_super()) with check (public.is_admin_or_super());

-- users: super-admin may delete; managers already update via Phase 0.
drop policy if exists users_delete_super on public.users;
create policy users_delete_super on public.users for delete to authenticated
  using (public.is_super_admin());

-- daily_entries: full insert/delete for managers (update granted in Phase 0).
drop policy if exists entries_insert_managers on public.daily_entries;
create policy entries_insert_managers on public.daily_entries for insert to authenticated
  with check (public.is_admin_or_super());
drop policy if exists entries_delete_managers on public.daily_entries;
create policy entries_delete_managers on public.daily_entries for delete to authenticated
  using (public.is_admin_or_super());

-- daily_attachments: managers may update/delete.
drop policy if exists attach_update_managers on public.daily_attachments;
create policy attach_update_managers on public.daily_attachments for update to authenticated
  using (public.is_admin_or_super()) with check (public.is_admin_or_super());
drop policy if exists attach_delete_managers on public.daily_attachments;
create policy attach_delete_managers on public.daily_attachments for delete to authenticated
  using (public.is_admin_or_super());

-- leave_requests: managers may insert/delete (approvers already update).
drop policy if exists leave_insert_managers on public.leave_requests;
create policy leave_insert_managers on public.leave_requests for insert to authenticated
  with check (public.is_admin_or_super());
drop policy if exists leave_delete_managers on public.leave_requests;
create policy leave_delete_managers on public.leave_requests for delete to authenticated
  using (public.is_admin_or_super());

-- benchmarks: admins may update (super-admin retains full control from Phase 0).
drop policy if exists benchmarks_update_admin on public.benchmarks;
create policy benchmarks_update_admin on public.benchmarks for update to authenticated
  using (public.is_admin_or_super()) with check (public.is_admin_or_super());

-- performance_evals: managers may write (SELECT redaction unchanged — they
-- still cannot read rows targeting their own identifier).
drop policy if exists perf_insert_managers on public.performance_evals;
create policy perf_insert_managers on public.performance_evals for insert to authenticated
  with check (public.is_admin_or_super());
drop policy if exists perf_update_managers on public.performance_evals;
create policy perf_update_managers on public.performance_evals for update to authenticated
  using (public.is_admin_or_super() and user_id <> auth.uid())
  with check (public.is_admin_or_super());
drop policy if exists perf_delete_managers on public.performance_evals;
create policy perf_delete_managers on public.performance_evals for delete to authenticated
  using (public.is_admin_or_super() and user_id <> auth.uid());

-- email_log: super-admin manage.
drop policy if exists email_write_super on public.email_log;
create policy email_write_super on public.email_log for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- profile_update_requests: managers may delete stale requests.
drop policy if exists pur_delete_managers on public.profile_update_requests;
create policy pur_delete_managers on public.profile_update_requests for delete to authenticated
  using (public.is_admin_or_super());

-- feedback: SUPER-ADMIN ONLY edit/delete. No admin policy by design.
drop policy if exists feedback_update_super on public.feedback;
create policy feedback_update_super on public.feedback for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists feedback_delete_super on public.feedback;
create policy feedback_delete_super on public.feedback for delete to authenticated
  using (public.is_super_admin());

-- audit_log: writable by managers (so override actions can be recorded).
drop policy if exists audit_insert_managers on public.audit_log;
create policy audit_insert_managers on public.audit_log for insert to authenticated
  with check (public.is_admin_or_super());

-- Privilege grants to back the new policies.
grant insert, update, delete on public.performance_evals to authenticated;
grant insert, update, delete on public.email_log to authenticated;
grant insert on public.audit_log to authenticated;
grant update, delete on public.feedback to authenticated;
