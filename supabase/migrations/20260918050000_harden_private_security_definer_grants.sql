-- Security hardening follow-up: revoke PUBLIC inherited EXECUTE on sensitive private SECURITY DEFINER helpers.
begin;
revoke execute on function private.admin_estimate_rows(regclass) from public, anon, authenticated;
revoke execute on function private.set_conversation_invite_message(text,uuid,text,text,text) from public, anon;
commit;
