import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerAuthUser, isSupabaseConfigured, DEMO_ROOMS } from '@/lib/dashboard-data';
import { saveRoomBundle, getAllCustomRooms } from '@/lib/room-storage';
import { generateInviteCode } from '@/lib/utils';
import type { Room, RoomMember, User } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const customRooms = getAllCustomRooms();
    const allRooms = [
      ...customRooms,
      ...DEMO_ROOMS.map((r) => ({
        ...r,
        github_repo: null,
      })),
    ];
    return NextResponse.json({ rooms: allRooms });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list rooms' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createServerClientSupabase();
    const user = await getServerAuthUser(supabase);

    const userId = user?.id || 'demo-dev-user-001';
    const userDisplayName = (user as any)?.display_name || (user as any)?.username || 'Developer';
    const userEmail = user?.email || 'developer@codetrack.ai';

    const roomId = `room-${Date.now()}`;
    const inviteCode = body.invite_code || generateInviteCode();
    const projectType = body.project_type === 'hardware' ? 'hardware' : 'software';

    const newRoom: Room = {
      id: roomId,
      name: body.name || 'New Hackathon Room',
      description: body.description || body.problem_statement || null,
      invite_code: inviteCode,
      hackathon_name: body.hackathon_name || 'Hackathon Sprint',
      problem_statement: body.problem_statement || null,
      start_date: body.start_date || new Date().toISOString(),
      deadline: body.submission_deadline || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      submission_deadline: body.submission_deadline || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      hackathon_url: body.hackathon_url || null,
      submission_format: body.submission_format || null,
      rules_text: body.rules_text || null,
      judging_rubric: body.judging_rubric || null,
      allowed_tech: body.allowed_tech || null,
      hackathon_sheet_row_id: body.hackathon_sheet_row_id || null,
      github_repo: body.github_repo || null,
      github_installation_id: null,
      team_size: Number(body.team_size) || 4,
      is_setup_complete: true,
      jury_expectations: body.judging_rubric || body.custom_agent_instructions || null,
      project_type: projectType,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const teamLeaderMember: RoomMember & { user: User } = {
      id: `member-${Date.now()}-leader`,
      room_id: roomId,
      user_id: userId,
      role_title: 'Team Leader',
      custom_role_name: null,
      flag_is_team_leader: true,
      flag_can_edit_repo: true,
      flag_can_trigger_nim: true,
      flag_can_assign_tasks: true,
      flag_can_upload_assets: true,
      flag_can_manage_bom: projectType === 'hardware',
      flag_can_invite_members: true,
      flag_can_edit_rules: true,
      status: 'active',
      joined_at: new Date().toISOString(),
      invited_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        id: userId,
        email: userEmail,
        username: (user as any)?.username || 'developer',
        display_name: userDisplayName,
        avatar_url: null,
        is_global_admin: true,
        fcm_token: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    // Save bundle to local disk & memory storage
    saveRoomBundle({
      room: newRoom,
      members: [teamLeaderMember],
      tasks: [],
      bom: [],
      artifacts: [],
    });

    // Also attempt Supabase insert if configured
    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        await admin.from('rooms').insert(newRoom);
        await admin.from('room_members').insert({
          room_id: roomId,
          user_id: userId,
          role_title: 'Team Leader',
          flag_is_team_leader: true,
          status: 'active',
        });
      } catch (dbErr) {
        console.warn('[Rooms POST] Supabase sync skipped:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      room: newRoom,
      invite_code: inviteCode,
    });
  } catch (err: any) {
    console.error('[Rooms POST Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to create room' }, { status: 500 });
  }
}
