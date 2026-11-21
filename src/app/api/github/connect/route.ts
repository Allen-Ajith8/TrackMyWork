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

  const slug = process.env.GITHUB_APP_SLUG;
  const hasGitHubApp =
    slug &&
    slug !== 'your-github-app-slug' &&
    process.env.GITHUB_APP_ID &&
    process.env.GITHUB_APP_ID !== 'your-github-app-id';

  // If GitHub App credentials are not configured or placeholder, redirect
  // to the direct repository connection modal in the room dashboard instead of 404ing!
  if (!hasGitHubApp) {
    return NextResponse.redirect(
      new URL(`/dashboard/rooms/${roomId}?connectGithub=true`, url.origin)
    );
  }

  try {
    const admin = createAdminClient();
    if (!(await canManageRoomRepo(admin, roomId, user.id))) {
      return NextResponse.json(
        { error: 'You do not have permission to connect a repository to this room.' },
        { status: 403 }
      );
    }

    const state = signGitHubState({ roomId, userId: user.id });
    const res = NextResponse.redirect(getAppInstallUrl(state));

    res.cookies.set('github_connect_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    return res;
  } catch (error) {
    // Graceful fallback to in-app direct repository linker
    return NextResponse.redirect(
      new URL(`/dashboard/rooms/${roomId}?connectGithub=true`, url.origin)
    );
  }
}
