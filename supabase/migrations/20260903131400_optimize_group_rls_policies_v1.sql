drop policy if exists group_inviter_insert on public.group_invitations;
drop policy if exists group_inviter_create on public.group_invitations;
create policy group_inviter_create on public.group_invitations
for insert to authenticated
with check (
  (inviter_id = (select auth.uid()))
  and exists (
    select 1
    from public.groups g
    join public.profiles p on p.smartlink_slug = g.owner_slug
    where g.id = group_invitations.group_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists group_inviter_read on public.group_invitations;
drop policy if exists group_inviter_manage on public.group_invitations;
create policy group_inviter_manage on public.group_invitations
for select to authenticated
using (inviter_id = (select auth.uid()));

drop policy if exists group_members_self_insert on public.group_members;
drop policy if exists group_owners_manage_members on public.group_members;
create policy group_members_insert on public.group_members
for insert to authenticated
with check (
  (user_id = (select auth.uid()))
  or exists (
    select 1
    from public.groups g
    join public.profiles p on p.smartlink_slug = g.owner_slug
    where g.id = group_members.group_id
      and p.user_id = (select auth.uid())
  )
);
