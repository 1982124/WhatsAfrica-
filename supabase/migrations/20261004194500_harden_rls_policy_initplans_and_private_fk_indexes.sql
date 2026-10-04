drop policy if exists collection_media_owner_manage on public.collection_media;
create policy collection_media_owner_manage on public.collection_media
for all to authenticated
using (
  exists (
    select 1 from public.product_collections pc
    where pc.id = collection_media.collection_id
      and pc.business_id in (
        select b.id from public.businesses b where b.owner_id = (select auth.uid())
      )
      and collection_media.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.product_collections pc
    where pc.id = collection_media.collection_id
      and pc.business_id in (
        select b.id from public.businesses b where b.owner_id = (select auth.uid())
      )
  )
  and owner_id = (select auth.uid())
);

drop policy if exists sourcing_quotes_owner_select on public.sourcing_quotes;
create policy sourcing_quotes_owner_select on public.sourcing_quotes
for select to authenticated
using (
  exists (
    select 1 from public.sourcing_requests r
    where r.id = sourcing_quotes.request_id
      and r.requester_id = (select auth.uid())
  )
);

drop policy if exists sourcing_matches_owner_select on public.sourcing_request_matches;
create policy sourcing_matches_owner_select on public.sourcing_request_matches
for select to authenticated
using (
  exists (
    select 1 from public.sourcing_requests r
    where r.id = sourcing_request_matches.request_id
      and r.requester_id = (select auth.uid())
  )
);

create index if not exists wassafrica_partner_commission_ledger_rule_idx
  on private.wassafrica_partner_commission_ledger(rule_id);
create index if not exists wassafrica_partner_commission_ledger_service_idx
  on private.wassafrica_partner_commission_ledger(service_id);
