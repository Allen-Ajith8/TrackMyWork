import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
 * Supabase's admin API has no "get user by email" call, so page through the
 * user list. Hackathon teams are small; 10 pages x 200 users is plenty.
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
 * Invite a teammate to a room.
 *
 * The invitee does not need an account: Supabase Auth sends them an invite
 * email, then we create/find their public.users profile and store a pending
 * room_members row with the requested permissions. Previously this was a
 * purely optimistic client-side update and nothing reached the database.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const roomId = params.id;
  const supabase = createServerClientSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as InviteBody | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const roleTitle = ROLE_TITLES.includes(body?.role_title ?? '')
    ? (body?.role_title as string)
    : 'Custom';

  const admin = createAdminClient();

  // Only active members with the invite permission (or global admins) may invite.
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

  // Resolve the invitee to a public.users row.
  let { data: invitee } = await admin
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  // Older deployments may not have the auth.users -> public.users trigger, so
  // an account can exist without a profile row. Find it in Auth and backfill
  // the profile instead of trying to re-invite an existing account.
  if (!invitee) {
    const authUser = await findAuthUserByEmail(admin, email);

    if (authUser) {
      const { data: created } = await admin
        .from('users')
        .insert({
          id: authUser.id,
          email,
          username:
            (authUser.user_metadata?.username as string | undefined) ||
            email.split('@')[0],
          display_name:
            (authUser.user_metadata?.display_name as string | undefined) ||
            (authUser.user_metadata?.full_name as string | undefined) ||
            email.split('@')[0],
          avatar_url:
            (authUser.user_metadata?.avatar_url as string | undefined) ||
            (authUser.user_metadata?.picture as string | undefined) ||
            null,
        })
        .select('*')
        .single();

      invitee = created;

      // Another concurrent request may have won the race.
      if (!invitee) {
        const { data: retry } = await admin
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        invitee = retry;
      }
    }
  }

  if (!invitee) {
    const origin = new URL(req.url).origin;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${origin}/auth/login` }
    );

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message || 'Could not send the invitation email.' },
        { status: 400 }
      );
    }

    const { data: created } = await admin
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    invitee = created;

    if (!invitee && invited?.user) {
      const { data: inserted } = await admin
        .from('users')
        .insert({
          id: invited.user.id,
          email,
          username: email.split('@')[0],
          display_name: invited.user.email?.split('@')[0] ?? email.split('@')[0],
        })
        .select('*')
        .single();
      invitee = inserted;
    }
  }

  if (!invitee) {
    return NextResponse.json(
      { error: 'Could not create a profile for that email address.' },
      { status: 500 }
    );
  }

  const { data: existing } = await admin
    .from('room_members')
    .select('id, status')
    .eq('room_id', roomId)
    .eq('user_id', invitee.id)
    .maybeSingle();

  if (existing) {
    if (body?.resend) {
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${new URL(req.url).origin}/auth/login`,
      });
      return NextResponse.json({
        resent: true,
        message: 'Invitation email sent again.',
      });
    }

    return NextResponse.json(
      { error: 'This person is already a member of this room.' },
      { status: 409 }
    );
  }

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
      flag_can_edit_repo: permissions.can_edit_repo ?? false,
      flag_can_trigger_nim: permissions.can_trigger_nim ?? false,
      flag_can_assign_tasks: permissions.can_assign_tasks ?? false,
      flag_can_upload_assets: permissions.can_upload_assets ?? false,
      flag_can_manage_bom: permissions.can_manage_bom ?? false,
      flag_can_invite_members: permissions.can_invite_members ?? false,
      flag_can_edit_rules: permissions.can_edit_rules ?? false,
      flag_is_team_leader: false,
      invited_by: user.id,
    })
    .select('*')
    .single();

  if (memberError) {
    console.error('Invite insert failed:', memberError);
    return NextResponse.json(
      { error: 'Could not save the invitation. Please try again.' },
      { status: 500 }
    );
  }

  // Best-effort in-app notification for invitees who already have an account.
  await admin.from('notifications').insert({
    user_id: invitee.id,
    room_id: roomId,
    type: 'invite',
    title: 'You have a room invite',
    content: {
      room_id: roomId,
      invited_by: user.id,
      role_title: roleTitle,
    },
    action_url: `/dashboard/rooms/${roomId}`,
  });

  return NextResponse.json({ member, user: invitee });
}
