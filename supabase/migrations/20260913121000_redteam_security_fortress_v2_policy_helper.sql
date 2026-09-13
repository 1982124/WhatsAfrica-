-- WASSAFRICA Red Team corrective migration.
-- business_has_active_marketplace_subscription() is referenced by public RLS policies.
-- anon/authenticated EXECUTE is therefore required for policy evaluation.
-- The function remains read-only SECURITY DEFINER with a fixed search_path.
GRANT EXECUTE ON FUNCTION public.business_has_active_marketplace_subscription(uuid) TO anon, authenticated;
ALTER FUNCTION public.business_has_active_marketplace_subscription(uuid) SET search_path = pg_catalog, public;
DO $$ BEGIN
  IF NOT has_function_privilege('anon','public.business_has_active_marketplace_subscription(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY_FORTRESS_FAIL: RLS policy helper unavailable to anon';
  END IF;
END $$;
