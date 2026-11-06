-- ============================================================================
-- TrackMyWork - Complete Supabase Schema with Two-Layer RBAC & RLS Policies
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS & TYPES
-- ============================================================================

CREATE TYPE member_status AS ENUM ('pending', 'active', 'rejected', 'left');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done', 'blocked');
CREATE TYPE task_category AS ENUM ('code', 'hardware', 'animation', 'design', 'docs', 'pitch');
CREATE TYPE bom_status AS ENUM ('planned', 'ordered', 'received', 'installed', 'failed');
CREATE TYPE notification_type AS ENUM ('invite', 'nim_alert', 'conflict', 'webhook', 'task_assigned', 'task_updated', 'deadline', 'sos');
CREATE TYPE project_type AS ENUM ('software', 'hardware', 'hybrid');
CREATE TYPE role_title AS ENUM ('Team Leader', 'Frontend', 'Backend', 'AI/ML', 'Pitch/Media', 'Video Editor', 'Hardware', 'Designer', 'DevOps', 'Custom');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    username TEXT UNIQUE, -- @handle format
    display_name TEXT,
    avatar_url TEXT,
    is_global_admin BOOLEAN DEFAULT FALSE,
    fcm_token TEXT, -- For FCM push notifications
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms (Hackathon Projects)
CREATE TABLE public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    invite_code TEXT NOT NULL UNIQUE, -- 6-digit code
    hackathon_sheet_row_id TEXT, -- Reference to master Google Sheet row
    github_repo TEXT, -- Full repo URL or owner/repo
    github_installation_id BIGINT, -- GitHub App installation ID
    team_size INT DEFAULT 4,
    is_setup_complete BOOLEAN DEFAULT FALSE,
    jury_expectations TEXT, -- Jury rubric/expectations text block
    project_type project_type DEFAULT 'software',
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room Rules (Strict constraints set by TL)
CREATE TABLE public.room_rules (
    room_id UUID PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
    tech_stack_locks JSONB DEFAULT '[]'::jsonb, -- e.g., ["No API costs", "Native Rust Android only"]
    budget_cap DECIMAL(12,2), -- Max budget in USD
    custom_agent_instructions TEXT, -- Injected into .cursorrules / AGENTS.md
    nim_auto_broadcast BOOLEAN DEFAULT FALSE, -- Auto-broadcast vs Manual Draft
    auto_task_progression BOOLEAN DEFAULT TRUE, -- GitHub webhook -> task completion
    non_tech_translation BOOLEAN DEFAULT TRUE, -- Translate backend commits for Pitch role
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room Members with Discord-style RBAC toggles
CREATE TABLE public.room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status member_status DEFAULT 'pending',
    role_title role_title DEFAULT 'Custom',
    custom_role_name TEXT, -- If role_title = 'Custom'
    
    -- Discord-style permission toggles
    flag_can_edit_repo BOOLEAN DEFAULT FALSE,
    flag_can_trigger_nim BOOLEAN DEFAULT FALSE,
    flag_can_assign_tasks BOOLEAN DEFAULT FALSE,
    flag_can_upload_assets BOOLEAN DEFAULT FALSE,
    flag_can_manage_bom BOOLEAN DEFAULT FALSE,
    flag_can_invite_members BOOLEAN DEFAULT FALSE,
    flag_can_edit_rules BOOLEAN DEFAULT FALSE,
    flag_is_team_leader BOOLEAN DEFAULT FALSE, -- Only one per room
    
    joined_at TIMESTAMPTZ,
    invited_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(room_id, user_id)
);

-- Tasks
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.users(id),
    title TEXT NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    category task_category DEFAULT 'code',
    priority INT DEFAULT 0, -- Higher = more urgent
    github_issue_number INT,
    github_pr_number INT,
    related_asset_ids UUID[] DEFAULT '{}', -- References to artifacts, BOM items, etc.
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    nim_summary TEXT, -- AI-generated summary from NIM
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hardware BOM (Bill of Materials)
CREATE TABLE public.hardware_bom (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    component TEXT NOT NULL,
    quantity INT DEFAULT 1,
    unit_est_cost DECIMAL(10,2),
    unit_actual_cost DECIMAL(10,2),
    total_est_cost DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_est_cost) STORED,
    total_actual_cost DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_actual_cost) STORED,
    buyer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status bom_status DEFAULT 'planned',
    prototype_cost DECIMAL(12,2), -- NIM-calculated prototype cost
    mass_prod_cost DECIMAL(12,2), -- NIM-calculated mass production cost
    supplier_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artifacts (APKs, Lottie files, presentations, etc.)
CREATE TABLE public.artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.users(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'apk', 'lottie', 'riv', 'presentation', 'video', 'image', 'other'
    file_url TEXT NOT NULL, -- Supabase Storage path
    file_size BIGINT,
    mime_type TEXT,
    tags TEXT[] DEFAULT '{}', -- e.g., ['Leo', 'Mia', 'character', 'v1']
    version TEXT,
    is_final BOOLEAN DEFAULT FALSE,
    canva_design_id TEXT, -- If synced from Canva
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL, -- Flexible payload
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT, -- Deep link for mobile
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NIM Automation Logs (Audit trail for AI actions)
CREATE TABLE public.nim_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    triggered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    trigger_type TEXT NOT NULL, -- 'github_webhook', 'manual', 'sos', 'scheduled'
    model_used TEXT NOT NULL, -- 'llama-3.3-70b', 'deepseek-r1', 'qwen2.5-coder-32b'
    prompt_tokens INT,
    completion_tokens INT,
    input_text TEXT,
    output_text TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ghost Mode Sessions (Global Admin observation)
CREATE TABLE public.ghost_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Vibe Coding Heartbeats (MCP Telemetry)
CREATE TABLE public.vibe_heartbeats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    editor_type TEXT, -- 'vscode', 'cursor', 'android-studio', 'opencode'
    file_path TEXT,
    language TEXT,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id, editor_type)
);

-- File Locks (Pre-commit conflict prevention)
CREATE TABLE public.file_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    editor_type TEXT,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
    UNIQUE(room_id, file_path)
);

-- Vibe Rollback Points (Working Demo Ready commits)
CREATE TABLE public.vibe_rollbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    commit_sha TEXT NOT NULL,
    commit_message TEXT,
    branch_name TEXT DEFAULT 'main',
    labeled_by UUID NOT NULL REFERENCES public.users(id),
    label TEXT DEFAULT 'Working Demo Ready',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Master Integrations (Global Admin only)
CREATE TABLE public.master_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE, -- 'nvidia_nim', 'google_sheets', 'github_app', 'canva', 'discord'
    config JSONB NOT NULL DEFAULT '{}', -- Encrypted secrets stored here
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room-specific Integration Overrides
CREATE TABLE public.room_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    integration_name TEXT NOT NULL, -- e.g., 'discord_webhook', 'canva_token'
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, integration_name)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_rooms_invite_code ON public.rooms(invite_code);
CREATE INDEX idx_rooms_created_by ON public.rooms(created_by);
CREATE INDEX idx_rooms_github_repo ON public.rooms(github_repo);
CREATE INDEX idx_room_members_room_id ON public.room_members(room_id);
CREATE INDEX idx_room_members_user_id ON public.room_members(user_id);
CREATE INDEX idx_room_members_status ON public.room_members(status);
CREATE INDEX idx_tasks_room_id ON public.tasks(room_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_github_issue ON public.tasks(github_issue_number);
CREATE INDEX idx_hardware_bom_room_id ON public.hardware_bom(room_id);
CREATE INDEX idx_artifacts_room_id ON public.artifacts(room_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_nim_logs_room_id ON public.nim_logs(room_id);
CREATE INDEX idx_vibe_heartbeats_room_id ON public.vibe_heartbeats(room_id);
CREATE INDEX idx_file_locks_room_id ON public.file_locks(room_id);
CREATE INDEX idx_vibe_rollbacks_room_id ON public.vibe_rollbacks(room_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nim_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vibe_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vibe_rollbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_integrations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Check if user is Global Super-Admin
CREATE OR REPLACE FUNCTION public.is_global_admin(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT is_global_admin FROM public.users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is Team Leader of a room
CREATE OR REPLACE FUNCTION public.is_team_leader(user_id UUID, room_id UUID)
RETURNS BOOLEAN AS $$
    SELECT flag_is_team_leader 
    FROM public.room_members 
    WHERE user_id = $1 AND room_id = $2 AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is active member of a room
CREATE OR REPLACE FUNCTION public.is_room_member(user_id UUID, room_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.room_members 
        WHERE user_id = $1 AND room_id = $2 AND status = 'active'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check specific permission flag for a user in a room
CREATE OR REPLACE FUNCTION public.has_room_permission(user_id UUID, room_id UUID, permission TEXT)
RETURNS BOOLEAN AS $$
    SELECT CASE 
        WHEN public.is_global_admin(user_id) THEN TRUE
        WHEN public.is_team_leader(user_id, room_id) THEN TRUE
        ELSE (
            SELECT CASE 
                WHEN permission = 'can_edit_repo' THEN flag_can_edit_repo
                WHEN permission = 'can_trigger_nim' THEN flag_can_trigger_nim
                WHEN permission = 'can_assign_tasks' THEN flag_can_assign_tasks
                WHEN permission = 'can_upload_assets' THEN flag_can_upload_assets
                WHEN permission = 'can_manage_bom' THEN flag_can_manage_bom
                WHEN permission = 'can_invite_members' THEN flag_can_invite_members
                WHEN permission = 'can_edit_rules' THEN flag_can_edit_rules
                ELSE FALSE
            END
            FROM public.room_members 
            WHERE user_id = $1 AND room_id = $2 AND status = 'active'
        )
    END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Global admins can read all users
CREATE POLICY "users_select_global_admin" ON public.users
    FOR SELECT USING (public.is_global_admin(auth.uid()));

-- ============================================================================
-- ROOMS POLICIES
-- ============================================================================

-- Global admins: full access to all rooms
CREATE POLICY "rooms_all_global_admin" ON public.rooms
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Room creators can read/update their rooms
CREATE POLICY "rooms_select_creator" ON public.rooms
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "rooms_update_creator" ON public.rooms
    FOR UPDATE USING (created_by = auth.uid());

-- Active room members can read room details
CREATE POLICY "rooms_select_member" ON public.rooms
    FOR SELECT USING (public.is_room_member(auth.uid(), id));

-- Team Leaders can update room settings
CREATE POLICY "rooms_update_tl" ON public.rooms
    FOR UPDATE USING (public.is_team_leader(auth.uid(), id));

-- Anyone can create a room (becomes creator)
CREATE POLICY "rooms_insert_authenticated" ON public.rooms
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- ============================================================================
-- ROOM RULES POLICIES
-- ============================================================================

-- Global admins: full access
CREATE POLICY "room_rules_all_global_admin" ON public.room_rules
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Team Leaders can manage rules
CREATE POLICY "room_rules_all_tl" ON public.room_rules
    FOR ALL USING (public.is_team_leader(auth.uid(), room_id));

-- Active members can read rules
CREATE POLICY "room_rules_select_member" ON public.room_rules
    FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

-- ============================================================================
-- ROOM MEMBERS POLICIES
-- ============================================================================

-- Global admins: full access
CREATE POLICY "room_members_all_global_admin" ON public.room_members
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Users can read their own memberships
CREATE POLICY "room_members_select_own" ON public.room_members
    FOR SELECT USING (user_id = auth.uid());

-- Team Leaders can manage all members in their room
CREATE POLICY "room_members_all_tl" ON public.room_members
    FOR ALL USING (public.is_team_leader(auth.uid(), room_id));

-- Members with can_invite_members flag can insert/update pending members
CREATE POLICY "room_members_invite" ON public.room_members
    FOR INSERT WITH CHECK (
        public.has_room_permission(auth.uid(), room_id, 'can_invite_members')
        AND status = 'pending'
    );

CREATE POLICY "room_members_update_invites" ON public.room_members
    FOR UPDATE USING (
        public.has_room_permission(auth.uid(), room_id, 'can_invite_members')
        AND status = 'pending'
    );

-- Active members can read other members in same room
CREATE POLICY "room_members_select_room" ON public.room_members
    FOR SELECT USING (
        public.is_room_member(auth.uid(), room_id)
    );

-- ============================================================================
-- TASKS POLICIES
-- ============================================================================

-- Global admins: full access
CREATE POLICY "tasks_all_global_admin" ON public.tasks
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Team Leaders: full access in their rooms
CREATE POLICY "tasks_all_tl" ON public.tasks
    FOR ALL USING (public.is_team_leader(auth.uid(), room_id));

-- Members with can_assign_tasks can create/update tasks
CREATE POLICY "tasks_insert_perm" ON public.tasks
    FOR INSERT WITH CHECK (
        public.has_room_permission(auth.uid(), room_id, 'can_assign_tasks')
    );

CREATE POLICY "tasks_update_perm" ON public.tasks
    FOR UPDATE USING (
        public.has_room_permission(auth.uid(), room_id, 'can_assign_tasks')
        OR assigned_to = auth.uid() -- Assignee can update status
    );

-- All active members can read tasks
CREATE POLICY "tasks_select_member" ON public.tasks
    FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

-- ============================================================================
-- HARDWARE BOM POLICIES
-- ============================================================================

-- Global admins: full access
CREATE POLICY "bom_all_global_admin" ON public.hardware_bom
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Team Leaders: full access
CREATE POLICY "bom_all_tl" ON public.hardware_bom
    FOR ALL USING (public.is_team_leader(auth.uid(), room_id));

-- Members with can_manage_bom can write
CREATE POLICY "bom_write_perm" ON public.hardware_bom
    FOR INSERT WITH CHECK (public.has_room_permission(auth.uid(), room_id, 'can_manage_bom'));

CREATE POLICY "bom_update_perm" ON public.hardware_bom
    FOR UPDATE USING (public.has_room_permission(auth.uid(), room_id, 'can_manage_bom'));

-- All active members can read
CREATE POLICY "bom_select_member" ON public.hardware_bom
    FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

-- ============================================================================
-- ARTIFACTS POLICIES
-- ============================================================================

-- Global admins: full access
CREATE POLICY "artifacts_all_global_admin" ON public.artifacts
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Team Leaders: full access
CREATE POLICY "artifacts_all_tl" ON public.artifacts
    FOR ALL USING (public.is_team_leader(auth.uid(), room_id));

-- Members with can_upload_assets can upload
CREATE POLICY "artifacts_insert_perm" ON public.artifacts
    FOR INSERT WITH CHECK (public.has_room_permission(auth.uid(), room_id, 'can_upload_assets'));

CREATE POLICY "artifacts_update_own" ON public.artifacts
    FOR UPDATE USING (
        public.has_room_permission(auth.uid(), room_id, 'can_upload_assets')
        OR uploaded_by = auth.uid()
    );

-- All active members can read
CREATE POLICY "artifacts_select_member" ON public.artifacts
    FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================

-- Users can only see their own notifications
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- System/Global admins can insert for any user
CREATE POLICY "notifications_insert_system" ON public.notifications
    FOR INSERT WITH CHECK (
        public.is_global_admin(auth.uid()) 
        OR auth.uid() = user_id -- Self-notifications (rare)
    );

-- ============================================================================
-- NIM LOGS POLICIES
-- ============================================================================

-- Global admins: full access
CREATE POLICY "nim_logs_all_global_admin" ON public.nim_logs
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Team Leaders can read logs in their rooms
CREATE POLICY "nim_logs_select_tl" ON public.nim_logs
    FOR SELECT USING (public.is_team_leader(auth.uid(), room_id));

-- Members who triggered can read their own logs
CREATE POLICY "nim_logs_select_triggered" ON public.nim_logs
    FOR SELECT USING (triggered_by = auth.uid());

-- ============================================================================
-- GHOST SESSIONS POLICIES
-- ============================================================================

-- Only Global Admins can manage ghost sessions
CREATE POLICY "ghost_sessions_all_global_admin" ON public.ghost_sessions
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- ============================================================================
-- VIBE HEARTBEATS POLICIES
-- ============================================================================

-- Global admins: full access
CREATE POLICY "vibe_heartbeats_all_global_admin" ON public.vibe_heartbeats
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Team Leaders can read all heartbeats in their room
CREATE POLICY "vibe_heartbeats_select_tl" ON public.vibe_heartbeats
    FOR SELECT USING (public.is_team_leader(auth.uid(), room_id));

-- Users can manage their own heartbeats
CREATE POLICY "vibe_heartbeats_upsert_own" ON public.vibe_heartbeats
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "vibe_heartbeats_update_own" ON public.vibe_heartbeats
    FOR UPDATE USING (user_id = auth.uid());

-- Active members can read heartbeats in their room (for purple pulsing dot)
CREATE POLICY "vibe_heartbeats_select_member" ON public.vibe_heartbeats
    FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

-- ============================================================================
-- FILE LOCKS POLICIES
-- ============================================================================

-- Global admins: full access
CREATE POLICY "file_locks_all_global_admin" ON public.file_locks
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Team Leaders can read all locks
CREATE POLICY "file_locks_select_tl" ON public.file_locks
    FOR SELECT USING (public.is_team_leader(auth.uid(), room_id));

-- Users can manage their own locks
CREATE POLICY "file_locks_upsert_own" ON public.file_locks
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "file_locks_delete_own" ON public.file_locks
    FOR DELETE USING (user_id = auth.uid());

-- Active members can read locks in their room (conflict warnings)
CREATE POLICY "file_locks_select_member" ON public.file_locks
    FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

-- ============================================================================
-- VIBE ROLLBACKS POLICIES
-- ============================================================================

-- Global admins: full access
CREATE POLICY "vibe_rollbacks_all_global_admin" ON public.vibe_rollbacks
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Team Leaders: full access
CREATE POLICY "vibe_rollbacks_all_tl" ON public.vibe_rollbacks
    FOR ALL USING (public.is_team_leader(auth.uid(), room_id));

-- Members with can_trigger_nim can create rollback points
CREATE POLICY "vibe_rollbacks_insert_perm" ON public.vibe_rollbacks
    FOR INSERT WITH CHECK (public.has_room_permission(auth.uid(), room_id, 'can_trigger_nim'));

-- All active members can read
CREATE POLICY "vibe_rollbacks_select_member" ON public.vibe_rollbacks
    FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

-- ============================================================================
-- MASTER INTEGRATIONS POLICIES
-- ============================================================================

-- Only Global Admins can manage master integrations
CREATE POLICY "master_integrations_all_global_admin" ON public.master_integrations
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- ============================================================================
-- ROOM INTEGRATIONS POLICIES
-- ============================================================================

-- Global admins: full access
CREATE POLICY "room_integrations_all_global_admin" ON public.room_integrations
    FOR ALL USING (public.is_global_admin(auth.uid()));

-- Team Leaders can manage room integrations
CREATE POLICY "room_integrations_all_tl" ON public.room_integrations
    FOR ALL USING (public.is_team_leader(auth.uid(), room_id));

-- Active members can read (for Discord/Canva sync status)
CREATE POLICY "room_integrations_select_member" ON public.room_integrations
    FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_room_rules_updated_at BEFORE UPDATE ON public.room_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_room_members_updated_at BEFORE UPDATE ON public.room_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hardware_bom_updated_at BEFORE UPDATE ON public.hardware_bom
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_artifacts_updated_at BEFORE UPDATE ON public.artifacts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_room_integrations_updated_at BEFORE UPDATE ON public.room_integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_master_integrations_updated_at BEFORE UPDATE ON public.master_integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- REALTIME PUBLICATION (for Supabase Realtime)
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.rooms,
    public.room_members,
    public.tasks,
    public.hardware_bom,
    public.artifacts,
    public.notifications,
    public.vibe_heartbeats,
    public.file_locks,
    public.vibe_rollbacks;

-- ============================================================================
-- STORAGE BUCKETS (Run in Storage > Policies)
-- ============================================================================

-- Buckets to create manually in Supabase Dashboard:
-- 1. artifacts (public: false) - APKs, Lottie, presentations
-- 2. avatars (public: true) - User profile pictures
-- 3. room-assets (public: false) - General room files

-- Storage policies (apply via Dashboard or SQL):
-- 
-- artifacts bucket:
-- CREATE POLICY "Artifacts upload" ON storage.objects FOR INSERT 
--   WITH CHECK (bucket_id = 'artifacts' AND auth.role() = 'authenticated');
-- CREATE POLICY "Artifacts read own room" ON storage.objects FOR SELECT 
--   USING (bucket_id = 'artifacts' AND (storage.foldername(name))[1] IN (
--     SELECT id::text FROM public.rooms WHERE public.is_room_member(auth.uid(), id)
--   ));
--
-- avatars bucket:
-- CREATE POLICY "Avatar upload" ON storage.objects FOR INSERT 
--   WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Avatar public read" ON storage.objects FOR SELECT 
--   USING (bucket_id = 'avatars');
--
-- room-assets bucket:
-- CREATE POLICY "Room assets upload" ON storage.objects FOR INSERT 
--   WITH CHECK (bucket_id = 'room-assets' AND auth.role() = 'authenticated');
-- CREATE POLICY "Room assets read" ON storage.objects FOR SELECT 
--   USING (bucket_id = 'room-assets' AND (storage.foldername(name))[1] IN (
--     SELECT id::text FROM public.rooms WHERE public.is_room_member(auth.uid(), id)
--   ));

-- ============================================================================
-- FUNCTION: Generate 6-digit invite code
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    exists_flag BOOLEAN;
BEGIN
    LOOP
        code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        SELECT EXISTS(SELECT 1 FROM public.rooms WHERE invite_code = code) INTO exists_flag;
        IF NOT exists_flag THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================================================
-- FUNCTION: Auto-create room_rules on room creation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_room_rules()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.room_rules (room_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_room_rules
    AFTER INSERT ON public.rooms
    FOR EACH ROW EXECUTE FUNCTION public.create_room_rules();

-- ============================================================================
-- FUNCTION: Auto-add creator as Team Leader
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_creator_as_tl()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.room_members (room_id, user_id, status, role_title, flag_is_team_leader, joined_at)
    VALUES (NEW.id, NEW.created_by, 'active', 'Team Leader', TRUE, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_add_creator_as_tl
    AFTER INSERT ON public.rooms
    FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_tl();

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

-- ============================================================================
-- PERMISSIONS & PROFILE BOOTSTRAP
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- Users can create their own profile row (needed for OAuth sign-ups).
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create a public.users row automatically for every new auth user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, username, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        NEW.raw_user_meta_data->>'username',
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name'
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture'
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for users created before the trigger existed.
INSERT INTO public.users (id, email, username, display_name, avatar_url)
SELECT
    u.id,
    COALESCE(u.email, ''),
    u.raw_user_meta_data->>'username',
    COALESCE(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name'
    ),
    COALESCE(
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture'
    )
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(users.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url),
    updated_at = NOW();

-- Storage policies (artifacts is private, avatars is public).
DROP POLICY IF EXISTS "Artifacts upload" ON storage.objects;
CREATE POLICY "Artifacts upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'artifacts' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Artifacts read own room" ON storage.objects;
CREATE POLICY "Artifacts read own room" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'artifacts'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM public.rooms
            WHERE public.is_room_member(auth.uid(), id)
        )
    );

DROP POLICY IF EXISTS "Avatar upload" ON storage.objects;
CREATE POLICY "Avatar upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Avatar update" ON storage.objects;
CREATE POLICY "Avatar update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
CREATE POLICY "Avatar public read" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Room assets upload" ON storage.objects;
CREATE POLICY "Room assets upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'room-assets' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Room assets read" ON storage.objects;
CREATE POLICY "Room assets read" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'room-assets'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM public.rooms
            WHERE public.is_room_member(auth.uid(), id)
        )
    );

NOTIFY pgrst, 'reload schema';
