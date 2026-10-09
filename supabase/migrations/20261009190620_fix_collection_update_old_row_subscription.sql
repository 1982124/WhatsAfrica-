-- UPDATE must authorize both the existing collection row and its resulting row.
ALTER POLICY collections_seller_update ON public.product_collections
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = product_collections.business_id
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
      AND b.smartlink_tier IN ('free', 'starter', 'business', 'premium')
      AND (
        b.smartlink_tier = 'free'
        OR EXISTS (
          SELECT 1 FROM public.user_subscriptions s
          WHERE s.user_id = (SELECT auth.uid())
            AND s.plan_code = b.smartlink_tier
            AND s.status = 'active'
            AND (s.ends_at IS NULL OR s.ends_at > now())
        )
      )
  )
);
