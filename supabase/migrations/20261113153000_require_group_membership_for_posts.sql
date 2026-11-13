-- Require group membership before an authenticated user can publish.
-- Owners and existing group admins remain authorized through is_group_admin().
-- Review-only migration: do not apply to production without a separate approval.

BEGIN;

DROP POLICY IF EXISTS group_posts_authenticated_insert
  ON public.group_posts;

CREATE POLICY group_posts_authenticated_insert
  ON public.group_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND (
      public.is_group_admin(group_id)
      OR EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = group_posts.group_id
          AND gm.user_id = (SELECT auth.uid())
          AND gm.role = ANY (ARRAY['member'::text, 'moderator'::text, 'admin'::text])
      )
    )
  );

COMMENT ON POLICY group_posts_authenticated_insert
  ON public.group_posts
  IS 'Only group members, moderators, admins, or the recognized group owner may publish posts.';

COMMIT;
