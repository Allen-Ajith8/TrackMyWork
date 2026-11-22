import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerAuthUser } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

type RespondBody = {
  action?: 'accept' | 'decline';
};

/**
 * POST /api/invites/[inviteId]/respond
 *
 * Authenticate via supabase.auth.getUser(), verify caller matches invitee_id
 * and status === 'pending'.
 *
 * - accept: upsert into room_members (active), mark room_invitations accepted
 *   (responded_at = now()), mark matching notifications is_read = true.
 *   Return { success: true, roomId }.
 * - decline: mark room_invitations declined (responded_at = now()),
 *   mark notification is_read = true. Return { success: true }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { inviteId: string } }
) {
  try {
    const inviteId = params.inviteId;
    const body = (await req.json().catch(() => null)) as RespondBody | null;
    const action = body?.action;

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json(
        { error: "Action must be 'accept' or 'decline'." },
        { status: 400 }
      );
    }

    const supabase = createServerClientSupabase();
    const user = await getServerAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in.' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Fetch the invitation and verify it exists & is pending.
    const { data: invitation, error: inviteError } = await admin
      .from('room_invitations')
      .select('id, room_id, inviter_id, invitee_id, invitee_email, role, status, responded_at')
      .eq('id', inviteId)
      .maybeSingle();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation already ${invitation.status}.` },
        { status: 409 }
      );
    }

    // Verify caller is the invitee.
    if (invitation.invitee_id !== user.id) {
      return NextResponse.json(
        { error: 'You are not the invitee for this invitation.' },
        { status: 403 }
      );
    }

    const respondedAt = new Date().toISOString();

    // Ensure the invitee's profile exists in public.users before inserting into
    // room_members (FK safety for Magic Link / OTP users).
    await admin
      .from('users')
      .upsert(
        {
          id: invitation.invitee_id,
          email: invitation.invitee_email,
          username: invitation.invitee_email.split('@')[0] || 'user',
          display_name: invitation.invitee_email.split('@')[0] || 'User',
          avatar_url: null,
          updated_at: respondedAt,
        },
        { onConflict: 'id' }
      );

    if (action === 'accept') {
      // Upsert into room_members as active.
      await admin.from('room_members').upsert(
        {
          room_id: invitation.room_id,
          user_id: invitation.invitee_id,
          status: 'active',
          role_title: (invitation.role as any) || 'Frontend',
          custom_role_name: null,
          flag_is_team_leader: false,
          flag_can_edit_repo: false,
          flag_can_trigger_nim: false,
          flag_can_assign_tasks: true,
          flag_can_upload_assets: true,
          flag_can_manage_bom: false,
          flag_can_invite_members: false,
          flag_can_edit_rules: false,
          joined_at: respondedAt,
          invited_by: invitation.inviter_id,
          created_at: respondedAt,
          updated_at: respondedAt,
        },
        { onConflict: 'room_id, user_id' }
      );

      // Mark invitation accepted.
      await admin
        .from('room_invitations')
        .update({ status: 'accepted', responded_at: respondedAt })
        .eq('id', inviteId);

      // Mark matching notification(s) read.
      await admin
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', invitation.invitee_id)
        .or(`metadata->>invitee_id.eq.${invitation.invitee_id},metadata->>invite_id.eq.${inviteId}`);

      return NextResponse.json({
        success: true,
        roomId: invitation.room_id,
        message: `Invitation accepted. You joined room ${invitation.room_id}.`,
      });
    }

    // decline
    await admin
      .from('room_invitations')
      .update({ status: 'declined', responded_at: respondedAt })
      .eq('id', inviteId);

    await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', invitation.invitee_id)
      .or(`metadata->>invitee_id.eq.${invitation.invitee_id},metadata->>invite_id.eq.${inviteId}`);

    return NextResponse.json({
      success: true,
      message: 'Invitation declined.',
    });
  } catch (error: any) {
    console.error('[Invite Respond API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error while responding to invitation.' },
      { status: 500 }
    );
  }
}
