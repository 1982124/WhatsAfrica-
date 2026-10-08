-- Allow authenticated business owners/members to read their own products.
-- Required because offer-create.html uses INSERT ... RETURNING (via .select('id')).
-- Public catalog visibility remains restricted to published products by the existing policy.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'business_owners_and_members_view_products'
  ) THEN
    CREATE POLICY "business_owners_and_members_view_products"
      ON public.products
      FOR SELECT
      TO authenticated
      USING (public.can_manage_business_products(business_id));
  END IF;
END
$$;
