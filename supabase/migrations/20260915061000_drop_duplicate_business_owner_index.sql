-- RED TEAM: remove confirmed duplicate index only.
-- Supabase advisor identified businesses_owner_id_idx and idx_businesses_owner_id as identical.
-- Keep the canonical businesses_owner_id_idx.
drop index if exists public.idx_businesses_owner_id;
