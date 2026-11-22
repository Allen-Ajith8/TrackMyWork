import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Room, RoomMember, Task, HardwareBomItem, Artifact, User } from '@/types/database';
import { DEMO_DEVELOPER_USER } from '@/lib/constants';

export function isAuthRequired(): boolean {
  return process.env.REQUIRE_AUTH === 'true' || process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true';
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  if (url.includes('your-project-id') || anonKey === 'your-anon-key') return false;
  return true;
}

export const DEMO_SERVER_USER: User & { aud: string; role: string; last_sign_in_at: string; app_metadata: any; user_metadata: any } = {
  id: 'demo-dev-user-001',
  email: 'developer@codetrack.ai',
  username: 'developer',
  display_name: 'Developer',
  avatar_url: null,
  is_global_admin: true,
  fcm_token: null,
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  last_sign_in_at: '2026-01-01T00:00:00.000Z',
  app_metadata: { provider: 'email' },
  user_metadata: {
    username: 'developer',
    display_name: 'Developer',
    full_name: 'Developer',
    is_global_admin: true,
  },
};

export interface DashboardRoom {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  project_type: string;
  team_size: number;
  created_at: string;
  [key: string]: unknown;
}

export const DEMO_ROOMS: DashboardRoom[] = [
  {
    id: 'demo-room-001',
    name: 'Algorithm Mastery & CodeTrack',
    description: 'Competitive programming, LeetCode sprints, and algorithm practice room.',
    invite_code: 'CODE-2026',
    project_type: 'software',
    team_size: 4,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'demo-room-002',
    name: 'Hardware & IoT Track',
    description: 'Embedded systems, BOM planning, and sensor telemetry room.',
    invite_code: 'HARD-2026',
    project_type: 'hardware',
    team_size: 3,
    created_at: '2026-01-02T00:00:00.000Z',
  },
];

export function getFallbackDemoRoom(roomId: string = 'demo-room-001'): {
  room: Room;
  members: (RoomMember & { user: User })[];
  tasks: (Task & { assignee?: User | null })[];
  bom: HardwareBomItem[];
  artifacts: (Artifact & { uploader?: User | null })[];
} {
  const matching = DEMO_ROOMS.find((r) => r.id === roomId) || DEMO_ROOMS[0];
  const room: Room = {
    id: roomId,
    name: matching.name,
    description: matching.description,
    invite_code: matching.invite_code,
    project_type: (matching.project_type as any) || 'software',
    team_size: matching.team_size,
    hackathon_sheet_row_id: null,
    github_repo: null,
    github_installation_id: null,
    is_setup_complete: true,
    submission_deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    jury_expectations: 'Seamless LeetCode integration, automated agent workflows, and real-time collaboration.',
    created_by: 'demo-dev-user-001',
    created_at: matching.created_at,
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  const members: (RoomMember & { user: User })[] = [
    {
      id: 'demo-member-001',
      room_id: roomId,
      user_id: 'demo-dev-user-001',
      role_title: 'Team Leader',
      custom_role_name: null,
      flag_is_team_leader: true,
      flag_can_edit_repo: true,
      flag_can_trigger_nim: true,
      flag_can_assign_tasks: true,
      flag_can_upload_assets: true,
      flag_can_manage_bom: true,
      flag_can_invite_members: true,
      flag_can_edit_rules: true,
      status: 'active',
      joined_at: '2026-01-01T00:00:00.000Z',
      invited_by: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      user: DEMO_DEVELOPER_USER,
    },
  ];

  const tasks: (Task & { assignee?: User | null })[] = [
    {
      id: 'demo-task-001',
      room_id: roomId,
      title: 'LeetCode GraphQL Integration & Runner',
      description: 'Fetch official code snippets, parse test cases, and verify deterministic code execution.',
      status: 'done',
      priority: 1,
      category: 'code',
      assigned_to: 'demo-dev-user-001',
      created_by: 'demo-dev-user-001',
      github_issue_number: null,
      github_pr_number: null,
      related_asset_ids: [],
      due_date: null,
      completed_at: '2026-01-01T00:00:00.000Z',
      nim_summary: 'Optimized runner completed with sub-50ms execution.',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      assignee: DEMO_DEVELOPER_USER,
    },
    {
      id: 'demo-task-002',
      room_id: roomId,
      title: 'Adaptive AI Mentor Debrief Experience',
      description: 'Expand debrief modal to 4xl layout with multi-column questions and telemetry sync.',
      status: 'in_progress',
      priority: 2,
      category: 'design',
      assigned_to: 'demo-dev-user-001',
      created_by: 'demo-dev-user-001',
      github_issue_number: null,
      github_pr_number: null,
      related_asset_ids: [],
      due_date: null,
      completed_at: null,
      nim_summary: null,
      created_at: '2026-01-02T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      assignee: DEMO_DEVELOPER_USER,
    },
  ];

  const bom: HardwareBomItem[] = [
    {
      id: 'demo-bom-001',
      room_id: roomId,
      component: 'ESP32-S3 DevKit',
      quantity: 2,
      unit_est_cost: 8.5,
      unit_actual_cost: 8.5,
      total_est_cost: 17.0,
      total_actual_cost: 17.0,
      buyer_id: 'demo-dev-user-001',
      status: 'received',
      prototype_cost: 17.0,
      mass_prod_cost: null,
      supplier_url: 'https://espressif.com',
      notes: 'Configured and tested with local firmware.',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ];

  const artifacts: (Artifact & { uploader?: User | null })[] = [
    {
      id: 'demo-art-001',
      room_id: roomId,
      uploaded_by: 'demo-dev-user-001',
      name: 'Architecture Diagram v1',
      type: 'image',
      file_url: '/placeholder.png',
      file_size: 1048576,
      mime_type: 'image/png',
      tags: ['architecture', 'diagram'],
      version: '1.0',
      is_final: false,
      canva_design_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      uploader: DEMO_DEVELOPER_USER,
    },
    {
      id: 'demo-art-002',
      room_id: roomId,
      uploaded_by: 'demo-dev-user-001',
      name: 'Drone Telemetry Protocol Spec',
      type: 'presentation',
      file_url: '/placeholder.png',
      file_size: 3565158,
      mime_type: 'application/pdf',
      tags: ['telemetry', 'mesh', 'ros2'],
      version: '2.0',
      is_final: true,
      canva_design_id: null,
      created_at: '2026-01-02T10:00:00.000Z',
      updated_at: '2026-01-02T10:00:00.000Z',
      uploader: DEMO_DEVELOPER_USER,
    },
    {
      id: 'demo-art-003',
      room_id: roomId,
      uploaded_by: 'demo-dev-user-001',
      name: 'Fintech Core Engine Android Build',
      type: 'apk',
      file_url: '/placeholder.png',
      file_size: 19188940,
      mime_type: 'application/vnd.android.package-archive',
      tags: ['android', 'release', 'apk'],
      version: '1.4',
      is_final: true,
      canva_design_id: null,
      created_at: '2026-01-03T14:30:00.000Z',
      updated_at: '2026-01-03T14:30:00.000Z',
      uploader: DEMO_DEVELOPER_USER,
    },
    {
      id: 'demo-art-004',
      room_id: roomId,
      uploaded_by: 'demo-dev-user-001',
      name: 'Algorithm Benchmark Run Demo',
      type: 'video',
      file_url: '/placeholder.png',
      file_size: 48025190,
      mime_type: 'video/mp4',
      tags: ['benchmark', 'demo', 'video'],
      version: '1.0',
      is_final: false,
      canva_design_id: null,
      created_at: '2026-01-04T08:15:00.000Z',
      updated_at: '2026-01-04T08:15:00.000Z',
      uploader: DEMO_DEVELOPER_USER,
    },
    {
      id: 'demo-art-005',
      room_id: roomId,
      uploaded_by: 'demo-dev-user-001',
      name: 'Radar & Sensor Telemetry UI Lottie',
      type: 'lottie',
      file_url: '/placeholder.png',
      file_size: 524288,
      mime_type: 'application/json',
      tags: ['animation', 'ui', 'radar'],
      version: '1.1',
      is_final: false,
      canva_design_id: null,
      created_at: '2026-01-04T12:00:00.000Z',
      updated_at: '2026-01-04T12:00:00.000Z',
      uploader: DEMO_DEVELOPER_USER,
    },
  ];

  return { room, members, tasks, bom, artifacts };
}

export async function getServerAuthUser(client?: ReturnType<typeof createServerClientSupabase>) {
  if (isSupabaseConfigured()) {
    const supabase = client ?? createServerClientSupabase();
    // 1. Try session cookies
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) return user;
    } catch {
      // Supabase unreachable or cookie invalid
    }

    // 2. Try Authorization: Bearer <token> (JWT)
    try {
      const headerList = headers();
      const authHeader = headerList.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) return user;
        }
      }
    } catch {
      // Outside request context
    }
  }

  // 3. Fallback: Check for custom personal user cookie in development/offline mode
  try {
    const cookieStore = cookies();
    const customUserCookie = cookieStore.get('trackmywork_user')?.value;
    if (customUserCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(customUserCookie));
        if (parsed && (parsed.email || parsed.id)) {
          return {
            ...DEMO_SERVER_USER,
            ...parsed,
            id: parsed.id || DEMO_SERVER_USER.id,
            email: parsed.email || DEMO_SERVER_USER.email,
            display_name: parsed.display_name || parsed.username || (parsed.email ? parsed.email.split('@')[0] : 'User'),
          };
        }
      } catch {
        // Bad cookie format
      }
    }
  } catch {
    // Outside request context
  }

  if (isAuthRequired()) {
    return null;
  }

  return DEMO_SERVER_USER;
}

/**
 * Guarantee the signed-in user has a public.users profile row.
 */
async function ensureUserProfile(
  _client: ReturnType<typeof createServerClientSupabase>,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
  }
) {
  if (!isSupabaseConfigured()) return;

  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) return;

    const metadata = user.user_metadata ?? {};
    const email = user.email ?? '';
    const rawUsername =
      metadata.user_name ||
      metadata.preferred_username ||
      metadata.username ||
      (email ? email.split('@')[0] : `user_${user.id.slice(0, 8)}`);
    const username = String(rawUsername).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    const displayName =
      metadata.display_name ||
      metadata.full_name ||
      metadata.name ||
      rawUsername;

    await admin.from('users').upsert(
      {
        id: user.id,
        email,
        username: username || null,
        display_name: displayName,
        avatar_url: metadata.avatar_url || metadata.picture || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch (err: any) {
    console.warn('[ensureUserProfile] Error ensuring user profile row:', err?.message);
  }
}

export const getDashboardContext = cache(async () => {
  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);

  if (!user) {
    return {
      supabase,
      user: null,
      rooms: [] as DashboardRoom[],
      roomIds: [] as string[],
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      supabase,
      user,
      rooms: DEMO_ROOMS,
      roomIds: DEMO_ROOMS.map((r) => r.id),
    };
  }

  await ensureUserProfile(supabase, user);

  let rooms: DashboardRoom[] = [];
  try {
    const { data: memberships } = await supabase
      .from('room_members')
      .select('room_id, role_title, flag_is_team_leader, rooms(*)')
      .eq('user_id', user.id)
      .eq('status', 'active');

    rooms = (memberships || [])
      .map((membership: any) => membership.rooms)
      .filter(Boolean) as DashboardRoom[];

    if (rooms.length === 0) {
      const { data: allRooms } = await supabase
        .from('rooms')
        .select('*')
        .limit(10);
      if (allRooms && allRooms.length > 0) {
        rooms = allRooms as DashboardRoom[];
      }
    }
  } catch {
    // Ignore database query failures in demo mode
  }

  if (rooms.length === 0) {
    rooms = DEMO_ROOMS;
  }

  return {
    supabase,
    user,
    rooms,
    roomIds: rooms.map((room) => room.id),
  };
});
