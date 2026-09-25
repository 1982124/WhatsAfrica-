begin;

-- Restore the documented free-commerce behavior after the 2026-09-22
-- marketplace visibility hardening. Free-tier businesses must not require
-- a paid subscription merely to expose already-published products.
create or replace function private.business_has_active_marketplace_subscription(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and (
        b.smartlink_tier = 'free'
        or exists (
          select 1
          from public.user_subscriptions s
          where s.user_id = b.owner_id
            and s.plan_code in ('starter','business','premium')
            and s.status in ('trialing','active','past_due')
            and (s.ends_at is null or s.ends_at > pg_catalog.now())
        )
        or exists (
          select 1
          from public.whatsafrica_identities i
          where i.user_id = b.owner_id
            and b.smartlink_tier = 'free'
            and i.free_ends_at > pg_catalog.now()
        )
      )
  );
$function$;

revoke all on function private.business_has_active_marketplace_subscription(uuid) from public;
grant execute on function private.business_has_active_marketplace_subscription(uuid) to anon, authenticated;

commit;
