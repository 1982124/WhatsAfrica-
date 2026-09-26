-- Red Team: cover remaining foreign-key columns flagged by Supabase performance advisor.
create index if not exists ai_credit_transactions_user_id_idx on public.ai_credit_transactions(user_id);
create index if not exists conversation_key_requests_requester_device_id_idx on public.conversation_key_requests(requester_device_id);
create index if not exists demand_actions_approved_by_idx on public.demand_actions(approved_by);
create index if not exists demand_actions_observation_id_idx on public.demand_actions(observation_id);
create index if not exists product_demand_requests_reviewed_by_idx on public.product_demand_requests(reviewed_by);
create index if not exists wassafrica_partners_user_id_idx on public.wassafrica_partners(user_id);
