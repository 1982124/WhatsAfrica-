create or replace function public.wassafrica_record_partner_event(
  p_referral_id uuid,p_event_type text,p_external_ref text default null,p_amount numeric default null,
  p_currency text default null,p_payload jsonb default '{}'::jsonb,p_occurred_at timestamptz default now()
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if coalesce((select auth.jwt()->>'role'),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  return private.wassafrica_record_partner_event(p_referral_id,p_event_type,p_external_ref,p_amount,p_currency,p_payload,p_occurred_at);
end $$;

revoke all on function public.wassafrica_record_partner_event(uuid,text,text,numeric,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.wassafrica_record_partner_event(uuid,text,text,numeric,text,jsonb,timestamptz) to service_role;