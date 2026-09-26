-- Red Team RLS initplan remediation and permissive-policy consolidation.
DO $$
DECLARE r record; q text; w text;
BEGIN
 FOR r IN SELECT schemaname,tablename,policyname,qual,with_check FROM pg_policies
 WHERE schemaname='public' AND policyname IN (
 'demand_observations_platform_admin','demand_clusters_platform_admin','demand_report_items_platform_admin','demand_actions_platform_admin',
 'marketplace_select_published_or_owner','marketplace_services_owner_insert','marketplace_services_owner_update',
 'external_payment_links_seller_delete','external_payment_links_seller_insert','external_payment_links_seller_update',
 'collection_items_paid_delete','collection_items_paid_insert','collection_items_paid_update','group_posts_authenticated_insert',
 'collections_seller_delete','collections_seller_insert','collections_seller_update','Owners create groups','Owners delete groups',
 'admin_partner_documents_insert','business_owners_and_members_manage_products_delete','business_owners_and_members_manage_products_insert',
 'business_owners_and_members_manage_products_update','collection_items_owner_delete','collection_items_owner_insert','collection_items_owner_update')
 LOOP
  q:=CASE WHEN r.qual IS NULL THEN NULL ELSE regexp_replace(r.qual,'\\mauth\\.uid\\(\\)','(select auth.uid())','g') END;
  w:=CASE WHEN r.with_check IS NULL THEN NULL ELSE regexp_replace(r.with_check,'\\mauth\\.uid\\(\\)','(select auth.uid())','g') END;
  IF q IS NOT NULL THEN EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',r.policyname,r.schemaname,r.tablename,q); END IF;
  IF w IS NOT NULL THEN EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',r.policyname,r.schemaname,r.tablename,w); END IF;
 END LOOP;
END $$;
DROP POLICY IF EXISTS external_payment_links_owner_select ON public.external_payment_links;
DROP POLICY IF EXISTS external_payment_links_public_active_read ON public.external_payment_links;
CREATE POLICY external_payment_links_authenticated_select ON public.external_payment_links FOR SELECT TO anon,authenticated
USING ((is_active=true AND (EXISTS (SELECT 1 FROM public.products p WHERE p.id=external_payment_links.product_id AND p.is_published=true) OR EXISTS (SELECT 1 FROM public.product_collections c WHERE c.id=external_payment_links.collection_id AND c.is_published=true))) OR owner_id=(select auth.uid()));
DROP POLICY IF EXISTS product_media_select ON public.product_media;
DROP POLICY IF EXISTS product_media_public_published_select ON public.product_media;
CREATE POLICY product_media_select ON public.product_media FOR SELECT TO anon,authenticated
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id=product_media.product_id AND p.is_published=true) OR EXISTS (SELECT 1 FROM public.products p JOIN public.businesses b ON b.id=p.business_id WHERE p.id=product_media.product_id AND b.owner_id=(select auth.uid())));
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;