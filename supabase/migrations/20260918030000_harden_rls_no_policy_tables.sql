-- Security hardening: remove direct Data API access to conversation invite secrets.
-- Access remains through the controlled invite RPCs.
begin;
revoke all on table public.conversation_invites from anon, authenticated;
commit;
