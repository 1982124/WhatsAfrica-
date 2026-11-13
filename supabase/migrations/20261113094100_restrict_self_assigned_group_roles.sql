-- P1 security hardening: a user may self-join only as a regular member.
-- Existing administrators and the mapped group owner retain their current
-- ability to assign the roles already permitted by the live policy.
-- This migration is intentionally isolated in a review branch; it has not
-- been applied to the production Supabase project.

BEGIN;

DROP POLICY IF EXISTS group_members_insert_combined
  ON public.group_members;

CREATE POLICY group_members_insert_combined
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.is_group_admin(group_id)
      AND role = ANY (ARRAY['member'::text, 'moderator'::text, 'admin'::text])
    )
    OR (
      user_id = (SELECT auth.uid())
      AND role = 'member'::text
    )
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      JOIN public.profiles p
        ON p.smartlink_slug = g.owner_slug
      WHERE g.id = group_members.group_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

COMMENT ON POLICY group_members_insert_combined
  ON public.group_members
  IS 'Self-join is restricted to role member; existing group admins and the mapped group owner retain role-management access.';

COMMIT;
