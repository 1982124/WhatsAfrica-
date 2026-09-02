-- WhatsAfrica: restrict direct client execution of privileged SECURITY DEFINER functions.
-- Public order tracking and share-link resolution remain intentionally callable anonymously.

REVOKE EXECUTE ON FUNCTION public.convert_business_live_to_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_business_live_to_lead(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_message_receipt(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_message_receipt(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.request_admin_email_otp(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_admin_email_otp(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.verify_admin_email_otp(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_email_otp(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_public_order_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order_status(uuid, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION private.resolve_share_link_impl(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.resolve_share_link_impl(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION private.create_guest_order(uuid, uuid, text, text, text, text, text, text, jsonb, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.apply_verified_payment_event(uuid, text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.platform_admin_overview_impl() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.claim_conversation_key_initializer(uuid, integer, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.consume_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.create_share_link(text, uuid, text, timestamptz, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.start_order_conversation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.create_customer_community_invite(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.accept_group_invitation(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.publish_platform_broadcast(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.admin_email_otp_create(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.admin_email_mfa_valid() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_conversation_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.public_payment_links_rows() FROM PUBLIC;
