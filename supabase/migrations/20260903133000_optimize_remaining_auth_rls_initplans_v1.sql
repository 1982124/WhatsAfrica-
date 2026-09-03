begin;

-- Replace per-row auth.uid() evaluation with init-plan evaluation on remaining hot policies.
alter policy "Owners add membership" on public.conversation_members
  with check (
    (user_id = (select auth.uid()))
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_members.conversation_id
        and c.owner_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.conversations c
      join public.business_live_sessions s on s.host_id = c.owner_id
      join public.business_live_participants p on p.session_id = s.id
      where c.id = conversation_members.conversation_id
        and p.user_id = (select auth.uid())
        and s.status = any(array['live'::text,'scheduled'::text])
        and p.user_id = c.owner_id
    )
  );

alter policy "Authenticated create conversations" on public.conversations
  with check (
    (owner_id = (select auth.uid()))
    or exists (
      select 1
      from public.business_live_sessions s
      join public.business_live_participants p on p.session_id = s.id
      where s.host_id = conversations.owner_id
        and p.user_id = (select auth.uid())
        and s.status = any(array['live'::text,'scheduled'::text])
    )
  );

alter policy external_payment_links_owner_delete on public.external_payment_links
  using (owner_id = (select auth.uid()));

alter policy external_payment_links_owner_insert on public.external_payment_links
  with check (owner_id = (select auth.uid()));

alter policy external_payment_links_owner_select on public.external_payment_links
  using (owner_id = (select auth.uid()));

alter policy external_payment_links_owner_update on public.external_payment_links
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

alter policy lead_members_manage_insert on public.leads
  with check (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = leads.business_id
        and bm.user_id = (select auth.uid())
        and bm.role = any(array['owner'::text,'admin'::text,'sales'::text])
    )
    or exists (
      select 1
      from public.conversations c
      join public.business_live_sessions s
        on s.host_id = c.owner_id
       and s.business_id = leads.business_id
      join public.business_live_participants p
        on p.session_id = s.id
       and p.user_id = (select auth.uid())
      where c.id = leads.conversation_id
        and leads.user_id = (select auth.uid())
        and leads.source = 'business_live'::text
        and s.status = any(array['live'::text,'scheduled'::text])
    )
  );

alter policy platform_broadcasts_admin_select on public.platform_broadcasts
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
  );

commit;
