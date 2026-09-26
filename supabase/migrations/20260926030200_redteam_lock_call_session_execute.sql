-- Call sessions require an authenticated conversation member.
revoke execute on function public.start_call_session(uuid,uuid,text) from public;
grant execute on function public.start_call_session(uuid,uuid,text) to authenticated;
