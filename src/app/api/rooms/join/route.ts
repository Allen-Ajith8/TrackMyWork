import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerAuthUser, isSupabaseConfigured, DEMO_ROOMS } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

/**
 * Teammates join a room using either:
 * 1. The 6-digit invite code (e.g. 477689)
 * 2. The direct room ID from their invitation link
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const roomId = typeof body?.roomId === 'string' ? body.roomId.trim() : '';

    if (!code && !roomId) {
      return NextResponse.json(
        { error: 'Please enter a 6-digit invite code or click your invitation link.' },
        { status: 400 }
      );
    }

    const supabase = createServerClientSupabase();
    let user = await getServerAuthUser(supabase);

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to join a room. Please sign in or create an account.' },
        { status: 401 }
      );
    }

    // Demo / offline mode fallback
    if (!isSupabaseConfigured()) {
      const matched = DEMO_ROOMS.find((r) => r.invite_code === code || r.id === roomId);
      const finalRoomId = matched ? matched.id : (roomId || 'demo-room-001');
      const finalRoomName = matched ? matched.name : (code ? `Room #${code}` : 'Hackathon Room');
      const finalInviteCode = matched ? matched.invite_code : (code || 'CODE-2026');

      return NextResponse.json({
        success: true,
        roomId: finalRoomId,
        roomName: finalRoomName,
        inviteCode: finalInviteCode,
        message: `Successfully joined ${finalRoomName}!`,
      });
    }

    const admin = createAdminClient();

    // Find the room by invite code or room ID
    let roomQuery = admin.from('rooms').select('*');
    if (code) {
      roomQuery = roomQuery.eq('invite_code', code);
    } else {
      roomQuery = roomQuery.eq('id', roomId);
    }

    const { data: room, error: roomError } = await roomQuery.maybeSingle();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Invalid invite code or room not found. Please verify the code with your team leader.' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await admin
      .from('room_members')
      .select('*')
      .eq('room_id', room.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      if (existingMember.status === 'pending') {
        // Activate their membership!
        await admin
          .from('room_members')
          .update({
            status: 'active',
            joined_at: new Date().toISOString(),
          })
          .eq('id', existingMember.id);
      }

      return NextResponse.json({
        success: true,
        roomId: room.id,
        roomName: room.name,
        inviteCode: room.invite_code,
        message: `Welcome back! You are an active member of ${room.name}.`,
      });
    }

    // Check if there is a pending invitation by user's email
    let pendingByEmail = null;
    if (user.email) {
      const { data: userProfile } = await admin
        .from('users')
        .select('id')
        .eq('email', user.email.toLowerCase())
        .maybeSingle();

      if (userProfile) {
        const { data: pending } = await admin
          .from('room_members')
          .select('*')
          .eq('room_id', room.id)
          .eq('user_id', userProfile.id)
          .maybeSingle();
        pendingByEmail = pending;
      }
    }

    if (pendingByEmail) {
      // Activate pending invitation
      await admin
        .from('room_members')
        .update({
          user_id: user.id,
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        .eq('id', pendingByEmail.id);

      return NextResponse.json({
        success: true,
        roomId: room.id,
        roomName: room.name,
        inviteCode: room.invite_code,
        message: `🎉 Welcome to ${room.name}! Your invitation has been accepted.`,
      });
    }

    // Insert new active member with default teammate permissions
    const { error: insertError } = await admin.from('room_members').insert({
      room_id: room.id,
      user_id: user.id,
      status: 'active',
      role_title: 'Frontend',
      flag_can_edit_repo: true,
      flag_can_trigger_nim: false,
      flag_can_assign_tasks: true,
      flag_can_upload_assets: true,
      flag_can_manage_bom: false,
      flag_can_invite_members: false,
      flag_can_edit_rules: false,
      flag_is_team_leader: false,
      joined_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[Join API] Failed to insert room member:', insertError);
      return NextResponse.json(
        { error: 'Could not join room. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      roomId: room.id,
      roomName: room.name,
      inviteCode: room.invite_code,
      message: `🎉 Successfully joined ${room.name}!`,
    });
  } catch (error: any) {
    console.error('[Join API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error while joining room.' },
      { status: 500 }
    );
  }
}
