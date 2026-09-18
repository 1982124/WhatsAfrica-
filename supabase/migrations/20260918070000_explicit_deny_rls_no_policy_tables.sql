-- Explicit deny policies for RLS-enabled internal tables with no direct API grants.
-- These policies preserve the current deny-by-default posture while making the
-- intended access boundary explicit for the security linter and future changes.
begin;

do $$
declare r record;
begin
  for r in select * from (values
    ('private','admin_email_challenges','omnicto_deny_all'),
    ('private','profile_identity_verifications','omnicto_deny_all'),
    ('public','ai_core_events','omnicto_deny_all'),
    ('public','api_rate_limits','omnicto_deny_all'),
    ('public','conversation_invites','omnicto_deny_all'),
    ('public','conversation_key_epochs','omnicto_deny_all'),
    ('public','guest_conversations','omnicto_deny_all'),
    ('public','guest_messages','omnicto_deny_all'),
    ('public','guest_sessions','omnicto_deny_all'),
    ('public','payment_events','omnicto_deny_all'),
    ('public','security_audit_log','omnicto_deny_all'),
    ('public','smartlink_tariff_rules','omnicto_deny_all'),
    ('public','telecom_revenue_rules','omnicto_deny_all')
  ) as x(schema_name,table_name,policy_name)
  loop
    execute format('drop policy if exists %I on %I.%I',r.policy_name,r.schema_name,r.table_name);
    execute format(
      'create policy %I on %I.%I as restrictive for all to public using (false) with check (false)',
      r.policy_name,r.schema_name,r.table_name
    );
  end loop;
end $$;

commit;
