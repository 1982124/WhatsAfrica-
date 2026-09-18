-- Security hardening: remove anonymous execution from authenticated/business guest messaging RPCs.
begin;
revoke all on function private.admin_estimate_rows(regclass) from anon, authenticated;
revoke all on function private.set_conversation_invite_message(text,uuid,text,text,text) from anon;
revoke all on function public.get_business_guest_conversations() from anon;
revoke all on function public.get_business_guest_inbox() from anon;
revoke all on function public.get_business_guest_messages(uuid) from anon;
revoke all on function public.reply_guest_message(uuid,text) from anon;
revoke all on function public.send_business_guest_message(uuid,text) from anon;
commit;
