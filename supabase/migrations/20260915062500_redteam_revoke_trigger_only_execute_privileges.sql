-- RED TEAM security hardening: trigger-only SECURITY DEFINER functions do not need client EXECUTE.
-- Keep trigger invocation intact; remove direct anon/authenticated execution only.
revoke execute on function private.admin_mfa_ok() from public, anon, authenticated;
revoke execute on function private.enforce_trial_ledger() from public, anon, authenticated;
revoke execute on function private.ensure_message_receipts() from public, anon, authenticated;
revoke execute on function private.ensure_whatsafrica_identity() from public, anon, authenticated;
revoke execute on function private.normalize_external_payment_link() from public, anon, authenticated;
revoke execute on function private.notify_community_comment() from public, anon, authenticated;
revoke execute on function private.notify_community_post() from public, anon, authenticated;
revoke execute on function private.notify_community_reaction() from public, anon, authenticated;
revoke execute on function private.notify_direct_message() from public, anon, authenticated;
revoke execute on function private.sync_call_history() from public, anon, authenticated;
revoke execute on function private.sync_direct_conversation_title() from public, anon, authenticated;
revoke execute on function private.trg_issue_digital_entitlements() from public, anon, authenticated;
revoke execute on function private.trg_orders_after_insert_digital_entitlements() from public, anon, authenticated;
revoke execute on function public.record_product_market_price_change() from public, anon, authenticated;
revoke execute on function private.is_trial_claimed(text,text,text,text,text) from public, anon, authenticated;
