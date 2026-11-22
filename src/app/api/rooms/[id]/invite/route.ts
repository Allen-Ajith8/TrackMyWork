import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerAuthUser, isSupabaseConfigured, DEMO_ROOMS } from '@/lib/dashboard-data';
import { sendRoomInviteEmail } from '@/lib/mailer';
import { getStoredRoomBundle, addMemberToStoredRoom } from '@/lib/room-storage';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InviteBody = {
  email?: string;
  role_title?: string;
  custom_role_name?: string | null;
  permissions?: Record<string, boolean>;
  resend?: boolean;
};

const ROLE_TITLES = [
  'Team Leader',
  'Frontend',
  'Backend',
  'AI/ML',
  'Pitch/Media',
  'Video Editor',
  'Hardware',
  'Designer',
  'DevOps',
  'Custom',
];

/**
 * Supabase admin listUsers pagination to match existing auth users
 */
async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;

    const match = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email
    );
    if (match) return match;
    if (data.users.length < 200) return null;
  }

  return null;
}

/**
 * Invite a teammate to a room via email.
 *
 * 1. Team Leader enters teammate's email.
 * 2. Supabase sends an invitation email containing the direct join link.
 * 3. The link directs to /dashboard/rooms/join?roomId=...&code=... so the teammate joins automatically.
 * 4. Also returns the direct join link so the leader can copy and share it immediately.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;
    const body = (await req.json().catch(() => null)) as InviteBody | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const roleTitle = (ROLE_TITLES.includes(body?.role_title ?? '')
      ? body?.role_title
      : 'Frontend') as import('@/types/database').RoleTitle;

    const origin = new URL(req.url).origin;
    const supabase = createServerClientSupabase();
    const user = await getServerAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in.' }, { status: 401 });
    }

    // --------------------------------------------------------------------------
    // DEMO / CUSTOM STORED ROOM / OFFLINE MODE
    // --------------------------------------------------------------------------
    if (!isSupabaseConfigured()) {
      const stored = getStoredRoomBundle(roomId);
      const matched = stored?.room || DEMO_ROOMS.find((r) => r.id === roomId) || DEMO_ROOMS[0];
      const inviteCode = matched ? matched.invite_code : 'INV-2026';
      const roomName = matched ? matched.name : 'Hackathon Room';
      const hackathonName = matched ? ((matched as any).hackathon_name as string | undefined) : undefined;
      const deadline = matched ? (((matched as any).submission_deadline || (matched as any).deadline) as string | undefined) : undefined;
      const joinUrl = `${origin}/dashboard/rooms/join?roomId=${encodeURIComponent(roomId)}&code=${encodeURIComponent(inviteCode)}&email=${encodeURIComponent(email)}`;

      const mailResult = await sendRoomInviteEmail({
        to: email,
        roomName,
        roleTitle,
        inviteCode,
        joinUrl,
        hackathonName,
        deadline,
        invitedByName: (user as any)?.display_name || (user as any)?.username || user.email?.split('@')[0] || 'Team Leader',
      });

      const newMember: import('@/types/database').RoomMember & { user: import('@/types/database').User } = {
        id: `member-${Date.now()}`,
        room_id: roomId,
        user_id: `invited-${email}`,
        role_title: roleTitle,
        custom_role_name: body?.custom_role_name || null,
        flag_is_team_leader: false,
        flag_can_edit_repo: body?.permissions?.can_edit_repo ?? true,
        flag_can_trigger_nim: body?.permissions?.can_trigger_nim ?? false,
        flag_can_assign_tasks: body?.permissions?.can_assign_tasks ?? true,
        flag_can_upload_assets: body?.permissions?.can_upload_assets ?? true,
        flag_can_manage_bom: body?.permissions?.can_manage_bom ?? false,
        flag_can_invite_members: body?.permissions?.can_invite_members ?? false,
        flag_can_edit_rules: body?.permissions?.can_edit_rules ?? false,
        status: 'pending' as const,
        joined_at: new Date().toISOString(),
        invited_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user: {
          id: `invited-${email}`,
          email,
          username: email.split('@')[0],
          display_name: email.split('@')[0],
          avatar_url: null,
          is_global_admin: false,
          fcm_token: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      if (stored) {
        addMemberToStoredRoom(roomId, newMember);
      }

      return NextResponse.json({
        success: true,
        emailSent: mailResult.success,
        member: newMember,
        user: newMember.user,
        joinUrl,
        inviteCode,
        mailtoUrl: mailResult.mailtoUrl,
        gmailUrl: mailResult.gmailUrl,
        previewUrl: mailResult.previewUrl || null,
        message: mailResult.success
          ? `Invitation email successfully dispatched directly to ${email}!`
          : `Invitation prepared for ${email}. Direct join link and room code are ready to share.`,
      });
    }

    // --------------------------------------------------------------------------
    // LIVE SUPABASE PRODUCTION MODE
    // --------------------------------------------------------------------------
    const admin = createAdminClient();

    // Verify room exists and get its invite code & name
    const { data: room, error: roomError } = await admin
      .from('rooms')
      .select('id, name, invite_code')
      .eq('id', roomId)
      .maybeSingle();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    }

    // Check caller permissions
    const [{ data: caller }, { data: callerProfile }] = await Promise.all([
      admin
        .from('room_members')
        .select('flag_is_team_leader, flag_can_invite_members')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
      admin.from('users').select('is_global_admin').eq('id', user.id).maybeSingle(),
    ]);

    const isGlobalAdmin = Boolean(callerProfile?.is_global_admin);
    const canInvite = Boolean(
      caller && (caller.flag_is_team_leader || caller.flag_can_invite_members)
    );

    if (!isGlobalAdmin && !canInvite) {
      return NextResponse.json(
        { error: 'You do not have permission to invite members to this room.' },
        { status: 403 }
      );
    }

    // Construct the direct join URL to embed in the email
    const joinUrl = `${origin}/dashboard/rooms/join?roomId=${encodeURIComponent(room.id)}&code=${encodeURIComponent(room.invite_code)}&email=${encodeURIComponent(email)}`;

    // Resolve or find the invitee in public.users
    let { data: invitee } = await admin
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    let emailSent = false;

    // Check if auth account exists
    let authUser = await findAuthUserByEmail(admin, email);

    if (!authUser) {
      // 1. Brand new user: Send Supabase invitation email with direct joinUrl redirect
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: joinUrl,
          data: {
            room_name: room.name,
            role_title: roleTitle,
            invite_code: room.invite_code,
            invited_by_name: user.email?.split('@')[0] || 'Team Leader',
          },
        }
      );

      if (inviteError) {
        console.warn('[Invite API] inviteUserByEmail returned error:', inviteError.message);
      } else {
        emailSent = true;
      }

      if (invited?.user) {
        authUser = invited.user;
      }
    } else {
      // 2. Existing auth user: Generate link and attempt notification / magiclink
      try {
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            redirectTo: joinUrl,
          },
        });
        if (!linkErr && linkData?.properties?.action_link) {
          // Email link generated successfully
          emailSent = true;
        }
      } catch (linkEx) {
        console.warn('[Invite API] generateLink exception:', linkEx);
      }
    }

    // Ensure invitee has a record in public.users
    if (!invitee) {
      const inviteeId = authUser?.id || `user_${Date.now()}`;
      const { data: created } = await admin
        .from('users')
        .insert({
          id: inviteeId,
          email,
          username: email.split('@')[0],
          display_name: email.split('@')[0],
        })
        .select('*')
        .maybeSingle();

      invitee = created || {
        id: inviteeId,
        email,
        username: email.split('@')[0],
        display_name: email.split('@')[0],
      };
    }

    // Check if user is already in room_members
    const { data: existing } = await admin
      .from('room_members')
      .select('id, status')
      .eq('room_id', roomId)
      .eq('user_id', invitee.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'active') {
        return NextResponse.json(
          {
            error: 'This person is already an active member of this room.',
            joinUrl,
            inviteCode: room.invite_code,
          },
          { status: 409 }
        );
      }

      // Re-send / reminder:
      await admin.from('notifications').insert({
        user_id: invitee.id,
        room_id: roomId,
        type: 'invite',
        title: `Invitation Reminder: ${room.name}`,
        content: {
          room_id: roomId,
          room_name: room.name,
          invite_code: room.invite_code,
          invited_by: user.id,
          role_title: roleTitle,
          join_url: joinUrl,
        },
        action_url: joinUrl,
      });

      return NextResponse.json({
        success: true,
        resent: true,
        member: existing,
        user: invitee,
        joinUrl,
        inviteCode: room.invite_code,
        message: `Invitation resent to ${email}! Direct join link: ${joinUrl}`,
      });
    }

    // 409 if there is already a pending room_invitations row for this invitee.
    const { data: pendingInvite } = await admin
      .from('room_invitations')
      .select('id, status')
      .eq('room_id', roomId)
      .eq('invitee_id', invitee.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingInvite) {
      return NextResponse.json(
        {
          error: 'This person already has a pending invitation to this room.',
          inviteId: pendingInvite.id,
          joinUrl,
          inviteCode: room.invite_code,
        },
        { status: 409 }
      );
    }

    // Insert pending room_member with the requested role & permissions
    const permissions = body?.permissions ?? {};
    const { data: member, error: memberError } = await admin
      .from('room_members')
      .insert({
        room_id: roomId,
        user_id: invitee.id,
        status: 'pending',
        role_title: roleTitle,
        custom_role_name:
          roleTitle === 'Custom' ? body?.custom_role_name?.trim() || null : null,
        flag_can_edit_repo: permissions.can_edit_repo ?? true,
        flag_can_trigger_nim: permissions.can_trigger_nim ?? false,
        flag_can_assign_tasks: permissions.can_assign_tasks ?? true,
        flag_can_upload_assets: permissions.can_upload_assets ?? true,
        flag_can_manage_bom: permissions.can_manage_bom ?? false,
        flag_can_invite_members: permissions.can_invite_members ?? false,
        flag_can_edit_rules: permissions.can_edit_rules ?? false,
        flag_is_team_leader: false,
        invited_by: user.id,
      })
      .select('*')
      .maybeSingle();

    if (memberError) {
      console.error('[Invite API] Member insert failed:', memberError);
    }

    // Also record a room_invitations row so the /api/invites/[id]/respond flow
    // can accept/decline this invite via the shared context table.
    let inviteId: string | null = null;
    try {
      const { data: inv } = await admin
        .from('room_invitations')
        .insert({
          room_id: roomId,
          inviter_id: user.id,
          invitee_id: invitee.id,
          invitee_email: email,
          role: roleTitle,
          status: 'pending',
        })
        .select('id')
        .maybeSingle();
      inviteId = inv?.id ?? null;
    } catch (invErr) {
      console.warn('[Invite API] room_invitations insert failed:', invErr);
    }

    // Create in-app notification
    await admin.from('notifications').insert({
      user_id: invitee.id,
      room_id: roomId,
      type: 'invite',
      title: `You have been invited to join ${room.name}`,
      content: {
        room_id: roomId,
        room_name: room.name,
        invite_code: room.invite_code,
        invited_by: user.id,
        role_title: roleTitle,
        join_url: joinUrl,
      },
      metadata: {
        invite_id: inviteId,
        room_id: roomId,
        room_name: room.name,
        inviter_name: (user as any)?.display_name || (user as any)?.username || user.email?.split('@')[0] || 'Team Leader',
      },
      action_url: joinUrl,
    });

    // Dispatch real email via mailer
    const mailResult = await sendRoomInviteEmail({
      to: email,
      roomName: room.name,
      roleTitle,
      inviteCode: room.invite_code,
      joinUrl,
      invitedByName: (user as any)?.display_name || (user as any)?.username || user.email?.split('@')[0] || 'Team Leader',
    });

    return NextResponse.json({
      success: true,
      inviteId,
      emailSent: Boolean(emailSent || mailResult.success),
      member: member || {
        room_id: roomId,
        user_id: invitee.id,
        status: 'pending',
        role_title: roleTitle,
      },
      user: invitee,
      joinUrl,
      inviteCode: room.invite_code,
      mailtoUrl: mailResult.mailtoUrl,
      gmailUrl: mailResult.gmailUrl,
      previewUrl: mailResult.previewUrl || null,
      message: Boolean(emailSent || mailResult.success)
        ? `Invitation email sent directly to ${email}! They can click the link in their mail or use code ${room.invite_code} to join.`
        : `Invitation created for ${email}. Direct join link and room code are ready to share.`,
    });
  } catch (error: any) {
    console.error('[Invite API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error while sending invitation.' },
      { status: 500 }
    );
  }
}
