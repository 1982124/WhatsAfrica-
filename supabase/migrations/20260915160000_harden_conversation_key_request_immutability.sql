create or replace function public.guard_conversation_key_request_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.id <> old.id
     or new.conversation_id <> old.conversation_id
     or new.requester_device_id <> old.requester_device_id
     or new.key_version <> old.key_version
     or new.created_at <> old.created_at then
    raise exception 'conversation_key_request_immutable_fields';
  end if;
  return new;
end;
$$;

drop trigger if exists conversation_key_request_immutable on public.conversation_key_requests;
create trigger conversation_key_request_immutable
before update on public.conversation_key_requests
for each row execute function public.guard_conversation_key_request_update();

create index if not exists conversation_key_requests_unfulfilled_idx
  on public.conversation_key_requests(conversation_id, key_version, requester_device_id)
  where fulfilled_at is null;
