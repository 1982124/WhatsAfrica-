alter table public.conversation_invites
  add column if not exists initial_ciphertext text,
  add column if not exists initial_iv text;

create or replace function private.set_conversation_invite_message(
  p_token text, p_ciphertext text, p_iv text
) returns boolean
language plpgsql
security definer
set search_path to 'public','private','extensions','pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if coalesce(length(p_token),0) < 32 then raise exception 'INVITE_REQUIRED'; end if;
  if coalesce(length(p_ciphertext),0) < 24 or coalesce(length(p_iv),0) < 8 then raise exception 'INVITE_PAYLOAD_INVALID'; end if;
  v_hash := encode(extensions.digest(btrim(p_token),'sha256'),'hex');
  update public.conversation_invites
     set initial_ciphertext=btrim(p_ciphertext), initial_iv=btrim(p_iv)
   where token_hash=v_hash
     and inviter_id=v_uid
     and accepted_at is null
     and expires_at>now();
  get diagnostics v_count = row_count;
  return v_count=1;
end;
$$;

create or replace function public.set_conversation_invite_message(
  p_token text, p_ciphertext text, p_iv text
) returns boolean
language sql
security invoker
as $$ select private.set_conversation_invite_message($1,$2,$3) $$;

revoke execute on function public.set_conversation_invite_message(text,text,text) from public, anon;
grant execute on function public.set_conversation_invite_message(text,text,text) to authenticated;

create or replace function private.get_conversation_invite_payload(p_token text)
returns table(
  id uuid,
  conversation_id uuid,
  expires_at timestamptz,
  initial_ciphertext text,
  initial_iv text
)
language sql
security definer
set search_path to 'public','private','extensions','pg_temp'
as $$
  select i.id,i.conversation_id,i.expires_at,i.initial_ciphertext,i.initial_iv
  from public.conversation_invites i
  where i.token_hash=encode(extensions.digest(btrim($1),'sha256'),'hex')
    and i.accepted_at is null
    and i.expires_at>now()
    and i.initial_ciphertext is not null
    and i.initial_iv is not null
  limit 1
$$;

create or replace function public.get_conversation_invite_payload(p_token text)
returns table(
  id uuid,
  conversation_id uuid,
  expires_at timestamptz,
  initial_ciphertext text,
  initial_iv text
)
language sql
security invoker
as $$ select * from private.get_conversation_invite_payload($1) $$;

revoke execute on function public.get_conversation_invite_payload(text) from public;
grant execute on function public.get_conversation_invite_payload(text) to anon, authenticated;
