-- P1 security hardening: a user may self-join only as a regular member.
-- Group owners and existing admins retain role-management access through
-- public.is_group_admin(), which checks groups.owner_id and admin memberships.
-- This migration is isolated in a review branch and is not applied to production.

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
  );

COMMENT ON POLICY group_members_insert_combined
  ON public.group_members
  IS 'Only group owners and existing admins may assign group roles; users may self-join only as member.';

COMMIT;
