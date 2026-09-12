drop function if exists public.set_conversation_invite_message(text,text,text);
drop function if exists private.set_conversation_invite_message(text,text,text);
drop function if exists public.get_conversation_invite_payload(text);
drop function if exists private.get_conversation_invite_payload(text);

alter table public.conversation_invites
  add column if not exists initial_message_id uuid,
  add column if not exists initial_key_wrap text;

create function private.set_conversation_invite_message(
  p_token text, p_message_id uuid, p_ciphertext text, p_iv text, p_key_wrap text
) returns boolean
language plpgsql security definer
set search_path to 'public','private','extensions','pg_temp'
as $$
declare v_uid uuid:=auth.uid(); v_hash text; v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if coalesce(length(p_token),0)<32 or p_message_id is null then raise exception 'INVITE_PAYLOAD_INVALID'; end if;
  if coalesce(length(p_ciphertext),0)<24 or coalesce(length(p_iv),0)<8 or coalesce(length(p_key_wrap),0)<24 then raise exception 'INVITE_PAYLOAD_INVALID'; end if;
  v_hash:=encode(extensions.digest(btrim(p_token),'sha256'),'hex');
  update public.conversation_invites set initial_message_id=p_message_id,initial_ciphertext=btrim(p_ciphertext),initial_iv=btrim(p_iv),initial_key_wrap=btrim(p_key_wrap)
  where token_hash=v_hash and inviter_id=v_uid and accepted_at is null and expires_at>now();
  get diagnostics v_count=row_count; return v_count=1;
end;$$;

create function public.set_conversation_invite_message(p_token text,p_message_id uuid,p_ciphertext text,p_iv text,p_key_wrap text)
returns boolean language sql security invoker
set search_path to 'public','private','extensions','pg_temp'
as $$ select private.set_conversation_invite_message($1,$2,$3,$4,$5) $$;
revoke execute on function public.set_conversation_invite_message(text,uuid,text,text,text) from public,anon;
grant execute on function public.set_conversation_invite_message(text,uuid,text,text,text) to authenticated;

create function private.get_conversation_invite_payload(p_token text)
returns table(id uuid,conversation_id uuid,expires_at timestamptz,initial_message_id uuid,initial_ciphertext text,initial_iv text,initial_key_wrap text)
language sql security definer
set search_path to 'public','private','extensions','pg_temp'
as $$
select i.id,i.conversation_id,i.expires_at,i.initial_message_id,i.initial_ciphertext,i.initial_iv,i.initial_key_wrap
from public.conversation_invites i
where i.token_hash=encode(extensions.digest(btrim($1),'sha256'),'hex') and i.accepted_at is null and i.expires_at>now()
  and i.initial_message_id is not null and i.initial_ciphertext is not null and i.initial_iv is not null and i.initial_key_wrap is not null
limit 1$$;

create function public.get_conversation_invite_payload(p_token text)
returns table(id uuid,conversation_id uuid,expires_at timestamptz,initial_message_id uuid,initial_ciphertext text,initial_iv text,initial_key_wrap text)
language sql security invoker
set search_path to 'public','private','extensions','pg_temp'
as $$ select * from private.get_conversation_invite_payload($1) $$;
revoke execute on function public.get_conversation_invite_payload(text) from public;
grant execute on function public.get_conversation_invite_payload(text) to anon,authenticated;
