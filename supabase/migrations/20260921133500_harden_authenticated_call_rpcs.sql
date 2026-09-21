-- OMNI CTO: least-privilege grants for authenticated messaging/call clients.
-- Applied to production on 2026-09-21; this migration records the same state for reproducibility.
revoke execute on function public.start_call_session(uuid, uuid, text) from anon;
grant execute on function public.start_call_session(uuid, uuid, text) to authenticated;
revoke execute on function public.ensure_web_device(jsonb) from anon;
grant execute on function public.ensure_web_device(jsonb) to authenticated;
revoke execute on function public.resolve_conversation_peer(uuid) from anon;
grant execute on function public.resolve_conversation_peer(uuid) to authenticated;
