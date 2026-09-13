-- WASSAFRICA Red Team / Security Fortress v1
-- Goal: reduce callable privilege, remove pg_temp from SECURITY DEFINER search paths,
-- and preserve only explicitly intentional anonymous/authenticated RPC surfaces.
-- This migration does NOT claim absolute invulnerability.

-- 1) Marketplace subscription helper is an internal policy helper, not a public RPC.
REVOKE ALL ON FUNCTION public.business_has_active_marketplace_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_has_active_marketplace_subscription(uuid) TO service_role;

-- 2) Remove PUBLIC EXECUTE from every exposed SECURITY DEFINER function.
--    Explicit grants below preserve the documented guest/public and authenticated RPCs.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
      r.schema_name, r.function_name, r.args);
  END LOOP;
END $$;

-- Public/guest surfaces that are intentionally callable without authentication.
GRANT EXECUTE ON FUNCTION public.bootstrap_guest_session() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_order(uuid, uuid, text, text, text, text, text, text, jsonb, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_guest_conversations() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_guest_inbox() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_guest_messages(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_conversation_messages(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_messages(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_order_status(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reply_guest_message(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_public_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_share_landing(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_business_guest_message(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_guest_message(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_guest_conversation(uuid, text, text, text) TO anon, authenticated;

-- Authenticated application surfaces.
GRANT EXECUTE ON FUNCTION public.accept_conversation_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_conversation_invite_for_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_conversation_key_initializer(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_business_live_to_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_conversation_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_paid_business(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_web_device(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_direct_contact_phone(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_delivered(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_receipt(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_broadcast(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_admin_email_otp(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation_key_epoch(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_direct_conversation_by_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_email_otp(text) TO authenticated;

-- Internal/service-only SECURITY DEFINER functions.
GRANT EXECUTE ON FUNCTION public.assert_whatsafrica_core_invariants() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_product_market_price_change() TO service_role;

-- 3) Remove session-controlled pg_temp from SECURITY DEFINER search paths.
--    Keep only trusted schemas needed by current function bodies.
ALTER FUNCTION public.accept_conversation_invite(text) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.accept_conversation_invite_for_phone(text) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.bootstrap_guest_session() SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.get_business_guest_conversations() SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.get_business_guest_inbox() SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.get_business_guest_messages(uuid) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.get_guest_conversation_messages(text, uuid) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.get_guest_messages(text) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.get_public_order_status(uuid, text) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.is_group_admin(uuid, uuid) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.prepare_broadcast(uuid[]) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.resolve_public_profile(text) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.resolve_share_landing(text) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.send_business_guest_message(uuid, text) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.send_guest_message(text, text) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.start_direct_conversation_by_user_id(uuid) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.start_guest_conversation(uuid, text, text, text) SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.claim_guest_session(text) SET search_path = pg_catalog, public, private, auth;

-- 4) Fail closed if a public SECURITY DEFINER function still has pg_temp in its path.
DO $$
DECLARE bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND coalesce(array_to_string(p.proconfig, ','), '') ~* 'search_path=.*pg_temp';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'SECURITY_FORTRESS_FAIL: % SECURITY DEFINER functions still expose pg_temp', bad_count;
  END IF;
END $$;

-- 5) Privilege regression assertions.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.business_has_active_marketplace_subscription(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY_FORTRESS_FAIL: marketplace subscription helper remains callable by anon';
  END IF;
  IF has_function_privilege('authenticated', 'public.business_has_active_marketplace_subscription(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY_FORTRESS_FAIL: marketplace subscription helper remains callable by authenticated';
  END IF;
  IF NOT has_function_privilege('anon', 'public.send_guest_message(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY_FORTRESS_FAIL: guest messaging RPC lost anon EXECUTE';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.start_direct_conversation_by_user_id(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY_FORTRESS_FAIL: direct conversation RPC lost authenticated EXECUTE';
  END IF;
END $$;
