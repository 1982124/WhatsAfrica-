create or replace function public.set_conversation_invite_message(
  p_token text, p_ciphertext text, p_iv text
) returns boolean
language sql
security invoker
set search_path to 'public','private','extensions','pg_temp'
as $$ select private.set_conversation_invite_message($1,$2,$3) $$;

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
set search_path to 'public','private','extensions','pg_temp'
as $$ select * from private.get_conversation_invite_payload($1) $$;
