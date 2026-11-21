-- ============================================================================
-- TrackMyWork - Migration: Hack-Timer & Panic Mode Support
-- ============================================================================
-- Adds submission_deadline to rooms table with RLS/trigger protection.
-- Adds is_blocker flag to tasks table for fast blocker tracking.
-- ============================================================================

-- 1. Add submission_deadline to public.rooms
ALTER TABLE public.rooms
    ADD COLUMN IF NOT EXISTS submission_deadline TIMESTAMPTZ;

-- 2. Add is_blocker to public.tasks
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS is_blocker BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tasks_is_blocker ON public.tasks(is_blocker);

-- 3. RLS policy allowing members with can_edit_rules to update rooms
DROP POLICY IF EXISTS "rooms_update_rules_editor" ON public.rooms;
CREATE POLICY "rooms_update_rules_editor" ON public.rooms
    FOR UPDATE USING (
        public.is_global_admin(auth.uid())
        OR public.is_team_leader(auth.uid(), id)
        OR public.has_room_permission(auth.uid(), id, 'can_edit_rules')
    );

-- 4. Constraint trigger ensuring ONLY Global Admins, Team Leaders,
--    or members with can_edit_rules can modify submission_deadline
CREATE OR REPLACE FUNCTION public.check_room_submission_deadline_permission()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.submission_deadline IS DISTINCT FROM OLD.submission_deadline THEN
        IF NOT (
            public.is_global_admin(auth.uid())
            OR public.is_team_leader(auth.uid(), OLD.id)
            OR public.has_room_permission(auth.uid(), OLD.id, 'can_edit_rules')
        ) THEN
            RAISE EXCEPTION 'Only Global Admins, Team Leaders, or members with can_edit_rules can change the submission deadline';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_room_submission_deadline ON public.rooms;
CREATE TRIGGER trg_check_room_submission_deadline
    BEFORE UPDATE ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.check_room_submission_deadline_permission();

-- 5. Realtime publication ensure rooms and tasks broadcast changes
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;
