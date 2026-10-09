-- Tighten collection mutation policies without removing free-tier access.
BEGIN;

-- Remove broad owner policies whose permissive OR bypassed subscription checks.
DROP POLICY IF EXISTS collections_owner_manage ON public.product_collections;
DROP POLICY IF EXISTS collection_items_owner_manage ON public.collection_items;
DROP POLICY IF EXISTS collection_media_owner_manage ON public.collection_media;

-- Restrict collection creation/update/deletion to supported tiers.
ALTER POLICY collections_seller_insert ON public.product_collections
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = product_collections.business_id
      AND (b.owner_id = (SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.business_collaborators bc
        WHERE bc.business_id=b.id AND bc.user_id=(SELECT auth.uid())
          AND bc.status='active' AND bc.role IN ('manager','editor')
      ))
      AND b.smartlink_tier IN ('free','starter','business','premium')
      AND (b.smartlink_tier='free' OR EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id=(SELECT auth.uid()) AND s.plan_code=b.smartlink_tier
          AND s.status='active' AND (s.ends_at IS NULL OR s.ends_at>now())
      ))
  )
);
ALTER POLICY collections_seller_update ON public.product_collections
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id=product_collections.business_id
      AND (b.owner_id=(SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.business_collaborators bc
        WHERE bc.business_id=b.id AND bc.user_id=(SELECT auth.uid())
          AND bc.status='active' AND bc.role IN ('manager','editor')
      ))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id=product_collections.business_id
      AND (b.owner_id=(SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.business_collaborators bc
        WHERE bc.business_id=b.id AND bc.user_id=(SELECT auth.uid())
          AND bc.status='active' AND bc.role IN ('manager','editor')
      ))
      AND b.smartlink_tier IN ('free','starter','business','premium')
      AND (b.smartlink_tier='free' OR EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id=(SELECT auth.uid()) AND s.plan_code=b.smartlink_tier
          AND s.status='active' AND (s.ends_at IS NULL OR s.ends_at>now())
      ))
  )
);
ALTER POLICY collections_seller_delete ON public.product_collections
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id=product_collections.business_id
      AND (b.owner_id=(SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.business_collaborators bc
        WHERE bc.business_id=b.id AND bc.user_id=(SELECT auth.uid())
          AND bc.status='active' AND bc.role IN ('manager','editor')
      ))
      AND b.smartlink_tier IN ('free','starter','business','premium')
      AND (b.smartlink_tier='free' OR EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id=(SELECT auth.uid()) AND s.plan_code=b.smartlink_tier
          AND s.status='active' AND (s.ends_at IS NULL OR s.ends_at>now())
      ))
  )
);

-- Owners and active collaborators can inspect their unpublished collection items.
ALTER POLICY collection_items_authenticated_read ON public.collection_items
USING (
  EXISTS (
    SELECT 1 FROM public.product_collections pc
    JOIN public.products p ON p.id=collection_items.product_id
    WHERE pc.id=collection_items.collection_id
      AND (
        (pc.is_published=true AND p.is_published=true)
        OR EXISTS (SELECT 1 FROM public.businesses b
                   WHERE b.id=pc.business_id AND b.owner_id=(SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM public.business_collaborators bc
                   WHERE bc.business_id=pc.business_id AND bc.user_id=(SELECT auth.uid())
                     AND bc.status='active')
      )
  )
);

-- The existing paid policies remain authoritative for paid tiers.
-- These additional policies preserve collection-item editing on the free tier.
CREATE POLICY collection_items_free_insert ON public.collection_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.product_collections pc
    JOIN public.businesses b ON b.id=pc.business_id
    JOIN public.products p ON p.id=collection_items.product_id
    WHERE pc.id=collection_items.collection_id AND p.business_id=pc.business_id
      AND b.smartlink_tier='free'
      AND (b.owner_id=(SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.business_collaborators bc
        WHERE bc.business_id=b.id AND bc.user_id=(SELECT auth.uid())
          AND bc.status='active' AND bc.role IN ('manager','editor')
      ))
  )
);
CREATE POLICY collection_items_free_update ON public.collection_items
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_collections pc
    JOIN public.businesses b ON b.id=pc.business_id
    WHERE pc.id=collection_items.collection_id AND b.smartlink_tier='free'
      AND (b.owner_id=(SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.business_collaborators bc
        WHERE bc.business_id=b.id AND bc.user_id=(SELECT auth.uid())
          AND bc.status='active' AND bc.role IN ('manager','editor')
      ))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.product_collections pc
    JOIN public.businesses b ON b.id=pc.business_id
    JOIN public.products p ON p.id=collection_items.product_id
    WHERE pc.id=collection_items.collection_id AND p.business_id=pc.business_id
      AND b.smartlink_tier='free'
      AND (b.owner_id=(SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.business_collaborators bc
        WHERE bc.business_id=b.id AND bc.user_id=(SELECT auth.uid())
          AND bc.status='active' AND bc.role IN ('manager','editor')
      ))
  )
);
CREATE POLICY collection_items_free_delete ON public.collection_items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_collections pc
    JOIN public.businesses b ON b.id=pc.business_id
    WHERE pc.id=collection_items.collection_id AND b.smartlink_tier='free'
      AND (b.owner_id=(SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.business_collaborators bc
        WHERE bc.business_id=b.id AND bc.user_id=(SELECT auth.uid())
          AND bc.status='active' AND bc.role IN ('manager','editor')
      ))
  )
);

-- Collection media is owner-managed; gate mutations by the same tier/subscription rule.
CREATE POLICY collection_media_owner_read ON public.collection_media
FOR SELECT TO authenticated
USING (
  owner_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.product_collections pc
    JOIN public.businesses b ON b.id=pc.business_id
    WHERE pc.id=collection_media.collection_id AND b.owner_id=(SELECT auth.uid())
  )
);
CREATE POLICY collection_media_owner_insert ON public.collection_media
FOR INSERT TO authenticated
WITH CHECK (
  owner_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.product_collections pc
    JOIN public.businesses b ON b.id=pc.business_id
    WHERE pc.id=collection_media.collection_id AND b.owner_id=(SELECT auth.uid())
      AND b.smartlink_tier IN ('free','starter','business','premium')
      AND (b.smartlink_tier='free' OR EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id=(SELECT auth.uid()) AND s.plan_code=b.smartlink_tier
          AND s.status='active' AND (s.ends_at IS NULL OR s.ends_at>now())
      ))
  )
);
CREATE POLICY collection_media_owner_update ON public.collection_media
FOR UPDATE TO authenticated
USING (
  owner_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.product_collections pc
    JOIN public.businesses b ON b.id=pc.business_id
    WHERE pc.id=collection_media.collection_id AND b.owner_id=(SELECT auth.uid())
      AND b.smartlink_tier IN ('free','starter','business','premium')
      AND (b.smartlink_tier='free' OR EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id=(SELECT auth.uid()) AND s.plan_code=b.smartlink_tier
          AND s.status='active' AND (s.ends_at IS NULL OR s.ends_at>now())
      ))
  )
)
WITH CHECK (
  owner_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.product_collections pc
    JOIN public.businesses b ON b.id=pc.business_id
    WHERE pc.id=collection_media.collection_id AND b.owner_id=(SELECT auth.uid())
      AND b.smartlink_tier IN ('free','starter','business','premium')
      AND (b.smartlink_tier='free' OR EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id=(SELECT auth.uid()) AND s.plan_code=b.smartlink_tier
          AND s.status='active' AND (s.ends_at IS NULL OR s.ends_at>now())
      ))
  )
);
CREATE POLICY collection_media_owner_delete ON public.collection_media
FOR DELETE TO authenticated
USING (
  owner_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.product_collections pc
    JOIN public.businesses b ON b.id=pc.business_id
    WHERE pc.id=collection_media.collection_id AND b.owner_id=(SELECT auth.uid())
      AND b.smartlink_tier IN ('free','starter','business','premium')
      AND (b.smartlink_tier='free' OR EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id=(SELECT auth.uid()) AND s.plan_code=b.smartlink_tier
          AND s.status='active' AND (s.ends_at IS NULL OR s.ends_at>now())
      ))
  )
);

COMMIT;
