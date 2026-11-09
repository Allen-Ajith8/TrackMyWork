import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAppInstallUrl, signGitHubState } from '@/lib/github/app';
import { canManageRoomRepo } from '@/lib/github/room-access';

export const dynamic = 'force-dynamic';

/**
 * Starts the GitHub App installation flow for a room.
 *
 * The signed state (also mirrored in an httpOnly cookie) binds the GitHub
 * redirect back to this room and user, so the callback cannot be hijacked by
 * a spoofed installation_id.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const roomId = url.searchParams.get('roomId');

  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId.' }, { status: 400 });
  }

  const supabase = createServerClientSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(
        `/auth/login?redirect=${encodeURIComponent(
          `/dashboard/rooms/${roomId}/settings`
        )}`,
        url.origin
      )
    );
  }

  const admin = createAdminClient();
  if (!(await canManageRoomRepo(admin, roomId, user.id))) {
    return NextResponse.json(
      { error: 'You do not have permission to connect a repository to this room.' },
      { status: 403 }
    );
  }

  try {
    const state = signGitHubState({ roomId, userId: user.id });
    const res = NextResponse.redirect(getAppInstallUrl(state));

    // Fallback for setups where GitHub does not echo `state` back to the
    // setup URL. The callback accepts either the query value or this cookie.
    res.cookies.set('github_connect_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    return res;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'GitHub App is not configured on the server.',
      },
      { status: 500 }
    );
  }
}
