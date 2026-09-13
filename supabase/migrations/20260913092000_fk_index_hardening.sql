-- WASSAFRICA closure hardening: cover foreign keys used by messaging, calls, CRM and commerce relations.
create index if not exists idx_business_crm_events_conversation_id on public.business_crm_events(conversation_id);
create index if not exists idx_business_crm_events_product_id on public.business_crm_events(product_id);
create index if not exists idx_business_crm_profiles_last_product_id on public.business_crm_profiles(last_product_id);
create index if not exists idx_conversation_invites_accepted_by on public.conversation_invites(accepted_by);
create index if not exists idx_guest_conversations_lead_id on public.guest_conversations(lead_id);
create index if not exists idx_leads_guest_conversation_id on public.leads(guest_conversation_id);
create index if not exists idx_message_media_signals_conversation_id on public.message_media_signals(conversation_id);
create index if not exists idx_message_media_signals_sender_id on public.message_media_signals(sender_id);
create index if not exists idx_message_reactions_user_id on public.message_reactions(user_id);

-- Remove the known duplicate guest-message index while retaining the created-at variant used for ordered reads.
drop index if exists public.guest_messages_conversation_idx;
