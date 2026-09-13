-- WASSAFRICA: marketplace visibility follows active subscription.
-- Free identity is a one-month introductory period; paid Starter/Business/Premium
-- keep marketplace publication visible while the subscription remains valid.
create or replace function public.business_has_active_marketplace_subscription(p_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and (
        exists (
          select 1
          from public.user_subscriptions s
          where s.user_id = b.owner_id
            and s.plan_code in ('starter','business','premium')
            and s.status in ('trialing','active','past_due')
            and (s.ends_at is null or s.ends_at > now())
        )
        or exists (
          select 1
          from public.whatsafrica_identities i
          where i.user_id = b.owner_id
            and b.smartlink_tier = 'free'
            and i.free_ends_at > now()
        )
      )
  );
$$;

revoke all on function public.business_has_active_marketplace_subscription(uuid) from public;
grant execute on function public.business_has_active_marketplace_subscription(uuid) to anon, authenticated;

drop policy if exists "public products" on public.products;
create policy "public products"
on public.products
for select
to public
using (
  is_published = true
  and public.business_has_active_marketplace_subscription(business_id)
);

drop policy if exists "marketplace_select_published_or_owner" on public.marketplace_services;
create policy "marketplace_select_published_or_owner"
on public.marketplace_services
for select
to anon, authenticated
using (
  (
    status = 'published'
    and exists (
      select 1
      from public.businesses b
      where b.owner_id = seller_id
        and public.business_has_active_marketplace_subscription(b.id)
    )
  )
  or (auth.uid() = seller_id)
);

create index if not exists idx_user_subscriptions_user_status_ends
  on public.user_subscriptions(user_id, status, ends_at);
create index if not exists idx_businesses_owner_id
  on public.businesses(owner_id);
