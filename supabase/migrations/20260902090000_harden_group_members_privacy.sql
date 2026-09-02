-- WhatsAfrica: prevent public enumeration of group membership.
-- Group membership is visible only to authenticated members of that group.

DROP POLICY IF EXISTS "group_members_authenticated_read" ON public.group_members;

CREATE POLICY "group_members_read_by_members"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = (SELECT auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS group_members_group_user_idx
ON public.group_members (group_id, user_id);
