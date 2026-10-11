-- Correct the commercial dashboard event mapping to match events emitted by the current Smart Link UI.
-- Counts are event counts, not unique visitors; conversion labels in the cockpit state that limitation.
CREATE OR REPLACE FUNCTION public.admin_commerce_overview(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_from timestamptz := now() - make_interval(days => v_days);
  v_result jsonb;
BEGIN
  IF NOT private.admin_mfa_ok() THEN
    RAISE EXCEPTION 'ADMIN_MFA_REQUIRED';
  END IF;

  IF NOT coalesce(public.is_platform_admin(), false) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT jsonb_build_object(
    'days', v_days,
    'from', v_from,
    'smart_link_opens', (
      SELECT count(*)
      FROM public.analytics_events
      WHERE event_type IN ('smart_link_opened', 'smart_link_viewed')
        AND created_at >= v_from
    ),
    'product_views', (
      SELECT count(*)
      FROM public.analytics_events
      WHERE event_type IN ('product_view', 'smart_link_product_viewed')
        AND created_at >= v_from
    ),
    -- Only contact-intent events are attributed to the commercial funnel.
    -- General conversation_opened events are excluded because they are not
    -- necessarily attributable to a Smart Link or product.
    'conversations', (
      SELECT count(*)
      FROM public.analytics_events
      WHERE event_type IN (
        'conversation_selected',
        'seller_contact_clicked',
        'smart_link_product_contact_clicked',
        'smart_link_contact_clicked'
      )
        AND created_at >= v_from
    ),
    'leads', (
      SELECT count(*) FROM public.leads WHERE created_at >= v_from
    ),
    'attributed_leads', (
      SELECT count(*) FROM public.leads
      WHERE created_at >= v_from AND smart_link_id IS NOT NULL
    ),
    'orders', (
      SELECT count(*) FROM public.orders WHERE created_at >= v_from
    ),
    'paid_orders', (
      SELECT count(*) FROM public.orders
      WHERE created_at >= v_from
        AND payment_status IN ('paid', 'succeeded', 'completed')
    ),
    'revenue', coalesce((
      SELECT sum(total) FROM public.orders
      WHERE created_at >= v_from
        AND payment_status IN ('paid', 'succeeded', 'completed')
    ), 0),
    'top_smart_links', coalesce((
      SELECT jsonb_agg(x ORDER BY x.opens DESC)
      FROM (
        SELECT sl.id, sl.slug, sl.title, count(*) AS opens
        FROM public.analytics_events ae
        JOIN public.smart_links sl ON sl.id = ae.entity_id
        WHERE ae.created_at >= v_from
          AND ae.event_type IN ('smart_link_opened', 'smart_link_viewed')
          AND ae.entity_type = 'smart_link'
        GROUP BY sl.id, sl.slug, sl.title
        ORDER BY opens DESC
        LIMIT 10
      ) x
    ), '[]'::jsonb),
    'lead_sources', coalesce((
      SELECT jsonb_agg(x ORDER BY x.count DESC)
      FROM (
        SELECT coalesce(source, 'unknown') AS source, count(*) AS count
        FROM public.leads
        WHERE created_at >= v_from
        GROUP BY coalesce(source, 'unknown')
        ORDER BY count DESC
        LIMIT 10
      ) x
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
