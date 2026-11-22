// ============================================================================
// TrackMyWork - TypeScript Types (Generated from Supabase Schema)
// ============================================================================

// Enums
export type MemberStatus = 'pending' | 'active' | 'rejected' | 'left';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type TaskCategory = 'code' | 'hardware' | 'animation' | 'design' | 'docs' | 'pitch';
export type BomStatus = 'planned' | 'ordered' | 'received' | 'installed' | 'failed';
export type NotificationType =
  | 'invite'
  | 'nim_alert'
  | 'conflict'
  | 'webhook'
  | 'task_assigned'
  | 'task_updated'
  | 'deadline'
  | 'sos';
export type ProjectType = 'software' | 'hardware' | 'hybrid';
export type RoleTitle =
  | 'Team Leader'
  | 'Frontend'
  | 'Backend'
  | 'AI/ML'
  | 'Pitch/Media'
  | 'Video Editor'
  | 'Hardware'
  | 'Designer'
  | 'DevOps'
  | 'Custom';

// Core Tables
export interface User {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_global_admin: boolean;
  fcm_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  hackathon_name?: string | null;
  problem_statement?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  submission_deadline?: string | null;
  hackathon_url?: string | null;
  submission_format?: string | null;
  rules_text?: string | null;
  judging_rubric?: string | null;
  allowed_tech?: string | null;
  hackathon_sheet_row_id: string | null;
  github_repo: string | null;
  github_installation_id: number | null;
  team_size: number;
  is_setup_complete: boolean;
  jury_expectations: string | null;
  project_type: ProjectType;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoomRules {
  room_id: string;
  tech_stack_locks: string[]; // JSONB array of strings
  budget_cap: number | null;
  custom_agent_instructions: string | null;
  rules_text?: string | null;
  judging_rubric?: string | null;
  allowed_tech?: string | null;
  submission_format?: string | null;
  nim_auto_broadcast: boolean;
  auto_task_progression: boolean;
  non_tech_translation: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  status: MemberStatus;
  role_title: RoleTitle;
  custom_role_name: string | null;
  flag_can_edit_repo: boolean;
  flag_can_trigger_nim: boolean;
  flag_can_assign_tasks: boolean;
  flag_can_upload_assets: boolean;
  flag_can_manage_bom: boolean;
  flag_can_invite_members: boolean;
  flag_can_edit_rules: boolean;
  flag_is_team_leader: boolean;
  joined_at: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  room_id: string;
  assigned_to: string | null;
  created_by: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  category: TaskCategory;
  priority: number;
  github_issue_number: number | null;
  github_pr_number: number | null;
  related_asset_ids: string[];
  due_date: string | null;
  completed_at: string | null;
  nim_summary: string | null;
  is_blocker?: boolean;
  created_at: string;
  updated_at: string;
}

export interface HardwareBomItem {
  id: string;
  room_id: string;
  component: string;
  quantity: number;
  unit_est_cost: number | null;
  unit_actual_cost: number | null;
  total_est_cost: number;
  total_actual_cost: number;
  buyer_id: string | null;
  status: BomStatus;
  prototype_cost: number | null;
  mass_prod_cost: number | null;
  supplier_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ArtifactType =
  | 'apk'
  | 'lottie'
  | 'riv'
  | 'presentation'
  | 'video'
  | 'image'
  | 'document'
  | 'note'
  | 'reference'
  | 'other';

export type ArtifactKind = 'file' | 'note' | 'reference' | 'link';

export interface Artifact {
  id: string;
  room_id: string;
  uploaded_by: string;
  name: string;
  type: ArtifactType;
  file_url: string;
  file_name?: string | null;
  storage_path?: string | null;
  file_size: number | null;
  mime_type: string | null;
  /** Full plain-text content for notes, links and small text artifacts. */
  content?: string | null;
  /** Server-extracted text for uploaded documents and PDFs. */
  extracted_text?: string | null;
  kind?: ArtifactKind | string | null;
  /** 'room' for room-only material, 'workspace' for shared workspace docs. */
  scope?: 'room' | 'workspace' | string | null;
  url?: string | null;
  metadata?: Record<string, unknown> | null;
  tags: string[];
  version: string | null;
  is_final: boolean;
  canva_design_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  room_id: string | null;
  type: NotificationType;
  title: string;
  content: Record<string, unknown>;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface NimLog {
  id: string;
  room_id: string;
  triggered_by: string | null;
  trigger_type: 'github_webhook' | 'manual' | 'sos' | 'scheduled';
  model_used: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  input_text: string | null;
  output_text: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface GhostSession {
  id: string;
  admin_id: string;
  room_id: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

export interface VibeHeartbeat {
  id: string;
  room_id: string;
  user_id: string;
  editor_type: 'vscode' | 'cursor' | 'android-studio' | 'opencode' | string;
  file_path: string | null;
  language: string | null;
  last_heartbeat: string;
  created_at: string;
}

export interface FileLock {
  id: string;
  room_id: string;
  user_id: string;
  file_path: string;
  editor_type: string | null;
  locked_at: string;
  expires_at: string;
}

export interface VibeRollback {
  id: string;
  room_id: string;
  commit_sha: string;
  commit_message: string | null;
  branch_name: string;
  labeled_by: string;
  label: string;
  created_at: string;
}

export interface MasterIntegration {
  id: string;
  name: 'nvidia_nim' | 'google_sheets' | 'github_app' | 'canva' | 'discord';
  config: Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoomIntegration {
  id: string;
  room_id: string;
  integration_name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Combined types for UI
export interface RoomWithMembers extends Room {
  members: (RoomMember & { user: User })[];
  rules: RoomRules | null;
  member_count: number;
  user_role: RoomMember | null;
  is_team_leader: boolean;
  is_global_admin: boolean;
}

export interface TaskWithAssignee extends Task {
  assignee: User | null;
  creator: User;
}

export interface HardwareBomWithBuyer extends HardwareBomItem {
  buyer: User | null;
}

export interface ArtifactWithUploader extends Artifact {
  uploader: User;
}

export interface NotificationWithRoom extends Notification {
  room: Room | null;
}

// Permission check types
export type RoomPermission =
  | 'can_edit_repo'
  | 'can_trigger_nim'
  | 'can_assign_tasks'
  | 'can_upload_assets'
  | 'can_manage_bom'
  | 'can_invite_members'
  | 'can_edit_rules';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form types
export interface CreateRoomData {
  name: string;
  description?: string;
  team_size?: number;
  project_type?: ProjectType;
  github_repo?: string;
}

export interface RoomSetupStep1Data {
  name: string;
  description?: string;
  hackathon_sheet_row_id?: string;
  github_repo?: string;
  team_size: number;
  project_type: ProjectType;
}

export interface RoomSetupStep2Data {
  members: {
    email: string;
    role_title: RoleTitle;
    custom_role_name?: string;
    permissions: Partial<Record<RoomPermission, boolean>>;
  }[];
}

export interface RoomSetupStep3Data {
  tech_stack_locks: string[];
  budget_cap?: number;
  custom_agent_instructions?: string;
  nim_auto_broadcast: boolean;
  auto_task_progression: boolean;
  non_tech_translation: boolean;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  assigned_to?: string;
  category: TaskCategory;
  priority?: number;
  due_date?: string;
  is_blocker?: boolean;
  github_issue_number?: number;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assigned_to?: string | null;
  category?: TaskCategory;
  priority?: number;
  due_date?: string | null;
  is_blocker?: boolean;
  github_pr_number?: number;
}

export interface CreateBomItemData {
  component: string;
  quantity: number;
  unit_est_cost?: number;
  unit_actual_cost?: number;
  buyer_id?: string;
  status?: BomStatus;
  supplier_url?: string;
  notes?: string;
}

export interface InviteMemberData {
  email: string;
  role_title: RoleTitle;
  custom_role_name?: string;
  permissions: Partial<Record<RoomPermission, boolean>>;
}

// NIM Types
export interface NimRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface NimResponse {
  id: string;
  choices: {
    message: { role: 'assistant'; content: string };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface NimTaskSummaryInput {
  commits: { sha: string; message: string; author: string; files: string[] }[];
  task_title: string;
  task_description: string | null;
}

export interface NimJuryAlignmentInput {
  jury_expectations: string;
  recent_commits: { sha: string; message: string; diff_summary: string }[];
  tasks_completed: string[];
  tasks_pending: string[];
}

export interface NimSosDebugInput {
  error_log: string;
  context: 'android_logcat' | 'rust_compiler' | 'flutter_build' | 'general';
  relevant_files: string[];
}

// Webhook Types
export interface GitHubWebhookPayload {
  action?: string;
  issue?: { number: number; title: string; state: string };
  pull_request?: { number: number; title: string; merged: boolean; head: { sha: string } };
  repository: { full_name: string; html_url: string };
  sender: { login: string; id: number };
  installation?: { id: number };
  commits?: { id: string; message: string; author: { name: string }; added: string[]; modified: string[]; removed: string[] }[];
}

export interface DiscordInteractionPayload {
  type: number;
  id: string;
  application_id: string;
  data?: {
    name: string;
    options?: { name: string; value: string }[];
  };
  guild_id?: string;
  channel_id: string;
  member?: { user: { id: string; username: string } };
}

// MCP Types
export interface VibeHeartbeatPayload {
  room_id: string;
  user_id: string;
  editor_type: VibeHeartbeat['editor_type'];
  file_path?: string;
  language?: string;
}

export interface FileLockPayload {
  room_id: string;
  user_id: string;
  file_path: string;
  editor_type: string;
}

export interface VibeRollbackPayload {
  room_id: string;
  commit_sha: string;
  commit_message: string;
  branch_name: string;
  label: string;
}