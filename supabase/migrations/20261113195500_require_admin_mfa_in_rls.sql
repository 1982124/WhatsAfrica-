-- Require a verified email-MFA session at the database boundary for admin-only records.
-- The public wrapper exposes only the caller's own boolean verification state.
create or replace function public.admin_mfa_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.admin_mfa_ok(), false);
$$;

revoke all on function public.admin_mfa_verified() from public;
revoke all on function public.admin_mfa_verified() from anon;
grant execute on function public.admin_mfa_verified() to authenticated, service_role;

drop policy if exists admin_partner_documents_select on public.admin_partner_documents;
create policy admin_partner_documents_select
on public.admin_partner_documents
for select
to authenticated
using (
  (select public.is_platform_admin())
  and (select public.admin_mfa_verified())
);

drop policy if exists admin_partner_documents_insert on public.admin_partner_documents;
create policy admin_partner_documents_insert
on public.admin_partner_documents
for insert
to authenticated
with check (
  (select public.is_platform_admin())
  and (select public.admin_mfa_verified())
  and created_by = (select auth.uid())
);

drop policy if exists admin_partner_documents_update on public.admin_partner_documents;
create policy admin_partner_documents_update
on public.admin_partner_documents
for update
to authenticated
using (
  (select public.is_platform_admin())
  and (select public.admin_mfa_verified())
)
with check (
  (select public.is_platform_admin())
  and (select public.admin_mfa_verified())
);

drop policy if exists admin_partner_documents_delete on public.admin_partner_documents;
create policy admin_partner_documents_delete
on public.admin_partner_documents
for delete
to authenticated
using (
  (select public.is_platform_admin())
  and (select public.admin_mfa_verified())
);

drop policy if exists demand_reports_admin_all on public.demand_reports;
create policy demand_reports_admin_all
on public.demand_reports
for all
to authenticated
using (
  (select public.is_platform_admin())
  and (select public.admin_mfa_verified())
)
with check (
  (select public.is_platform_admin())
  and (select public.admin_mfa_verified())
);

-- Broadcast history is also restricted to a verified administrator session.
drop policy if exists platform_broadcasts_admin_select on public.platform_broadcasts;
create policy platform_broadcasts_admin_select
on public.platform_broadcasts
for select
to authenticated
using (
  (select public.is_platform_admin())
  and (select public.admin_mfa_verified())
);
