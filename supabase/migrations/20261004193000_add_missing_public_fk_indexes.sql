create index if not exists collection_media_owner_idx on public.collection_media(owner_id);
create index if not exists sourcing_quotes_match_idx on public.sourcing_quotes(match_id);
create index if not exists sourcing_requests_requester_idx on public.sourcing_requests(requester_id);
