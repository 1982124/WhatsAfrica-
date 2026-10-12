-- Preserve fulfilled recovery attempts for audit, but allow a new pending attempt
-- when a returned envelope fails client-side AES-GCM validation.
-- This uniqueness rule is backed by a table constraint, so drop the constraint
-- rather than attempting to drop its supporting index directly.
ALTER TABLE public.conversation_key_requests
  DROP CONSTRAINT IF EXISTS conversation_key_requests_conversation_id_requester_device__key;

CREATE UNIQUE INDEX conversation_key_requests_pending_unique
  ON public.conversation_key_requests (conversation_id, requester_device_id, key_version)
  WHERE fulfilled_at IS NULL;
