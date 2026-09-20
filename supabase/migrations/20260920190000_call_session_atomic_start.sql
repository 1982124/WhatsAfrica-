create or replace function public.start_call_session(p_conversation_id uuid,p_recipient_id uuid,p_media_mode text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid:=auth.uid(); v_call uuid;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_media_mode not in ('audio','video') then raise exception 'INVALID_MEDIA_MODE'; end if;
 if not exists(select 1 from conversation_members where conversation_id=p_conversation_id and user_id=v_uid) then raise exception 'CALLER_NOT_MEMBER'; end if;
 if not exists(select 1 from conversation_members where conversation_id=p_conversation_id and user_id=p_recipient_id) then raise exception 'RECIPIENT_NOT_MEMBER'; end if;
 if p_recipient_id=v_uid then raise exception 'INVALID_RECIPIENT'; end if;
 insert into call_sessions(conversation_id,initiator_id,status,media_mode,expires_at)
 values(p_conversation_id,v_uid,'ringing',case when p_media_mode='video' then 'audio_video' else 'audio' end,now()+interval '2 minutes')
 returning id into v_call;
 insert into call_participants(call_id,user_id,role) values(v_call,v_uid,'initiator'),(v_call,p_recipient_id,'participant');
 insert into call_inbox(call_id,recipient_id,sender_id,status) values(v_call,p_recipient_id,v_uid,'ringing');
 return v_call;
end $$;
grant execute on function public.start_call_session(uuid,uuid,text) to authenticated;
