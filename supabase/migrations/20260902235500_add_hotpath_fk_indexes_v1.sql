-- WhatsAfrica: indexes for frequently joined foreign-key columns.
create index if not exists idx_external_payment_links_business_id on public.external_payment_links(business_id);
create index if not exists idx_group_invitations_accepted_by on public.group_invitations(accepted_by) where accepted_by is not null;
create index if not exists idx_group_invitations_inviter_id on public.group_invitations(inviter_id);
create index if not exists idx_platform_broadcasts_created_by on public.platform_broadcasts(created_by);
create index if not exists idx_user_subscriptions_plan_code on public.user_subscriptions(plan_code);
