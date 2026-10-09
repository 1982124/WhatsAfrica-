-- Align the UPDATE USING predicate with the paid-tier subscription check.
-- UPDATE evaluates USING on the old row as well as WITH CHECK on the new row.
ALTER POLICY collection_items_paid_update ON public.collection_items
USING (
  EXISTS (
    SELECT 1
    FROM public.product_collections pc
    JOIN public.businesses b ON b.id = pc.business_id
    WHERE pc.id = collection_items.collection_id
      AND b.smartlink_tier IN ('starter', 'business', 'premium')
      AND (
        b.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.business_collaborators bc
          WHERE bc.business_id = b.id
            AND bc.user_id = (SELECT auth.uid())
            AND bc.status = 'active'
            AND bc.role IN ('manager', 'editor')
        )
      )
      AND EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id = (SELECT auth.uid())
          AND s.plan_code = b.smartlink_tier
          AND s.status = 'active'
          AND (s.ends_at IS NULL OR s.ends_at > now())
      )
  )
);
