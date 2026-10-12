-- Preserve fulfilled recovery attempts for audit, but allow a new pending attempt
-- when a returned envelope fails client-side AES-GCM validation.
DROP INDEX IF EXISTS public.conversation_key_requests_conversation_id_requester_device__key;

CREATE UNIQUE INDEX conversation_key_requests_pending_unique
  ON public.conversation_key_requests (conversation_id, requester_device_id, key_version)
  WHERE fulfilled_at IS NULL;
