-- Harden private internal tables with RLS and explicit deny-by-default policies.
-- The tables are accessed by privileged SECURITY DEFINER routines only.
-- Direct client/API access must remain denied.

begin;

alter table private.admin_session_verifications enable row level security;
alter table private.ai_usage_events enable row level security;
alter table private.discount_codes enable row level security;
alter table private.discount_redemptions enable row level security;
alter table private.trial_ledger enable row level security;

do $$
declare r record;
begin
  for r in select * from (values
    ('private','admin_session_verifications'),
    ('private','ai_usage_events'),
    ('private','discount_codes'),
    ('private','discount_redemptions'),
    ('private','trial_ledger')
  ) as x(schema_name,table_name)
  loop
    execute format('drop policy if exists omnicto_deny_all on %I.%I',r.schema_name,r.table_name);
    execute format('create policy omnicto_deny_all on %I.%I as restrictive for all to public using (false) with check (false)',r.schema_name,r.table_name);
  end loop;
end $$;

commit;
