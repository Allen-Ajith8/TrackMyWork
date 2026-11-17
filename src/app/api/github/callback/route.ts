import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getInstallation,
  listInstallationRepos,
  verifyGitHubState,
} from '@/lib/github/app';
import { canManageRoomRepo } from '@/lib/github/room-access';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'github_connect_state';

function clearStateCookie(res: NextResponse) {
  res.cookies.set(STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

function settingsUrl(
  origin: string,
  roomId: string | null | undefined,
  params: Record<string, string>
) {
  const path = roomId
    ? `/dashboard/rooms/${roomId}/settings`
    : '/dashboard/rooms';
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

/**
 * GitHub App setup URL. GitHub redirects here after the user installs (or
 * updates) the app, with `installation_id` and, when supported, `state`.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;

  const installationIdRaw = url.searchParams.get('installation_id');
  const stateFromQuery = url.searchParams.get('state');
  const stateFromCookie = req.cookies.get(STATE_COOKIE)?.value ?? null;
  const state = verifyGitHubState(stateFromQuery || stateFromCookie);

  if (!state) {
    return clearStateCookie(
      NextResponse.redirect(
        settingsUrl(origin, null, {
          github_error:
            'The GitHub connection request expired or was invalid. Please try again.',
        })
      )
    );
  }

  const fail = (message: string) =>
    clearStateCookie(
      NextResponse.redirect(
        settingsUrl(origin, state.roomId, { github_error: message })
      )
    );

  if (!installationIdRaw) {
    return fail('GitHub did not return an installation. Please try again.');
  }

  const installationId = Number(installationIdRaw);
  if (!Number.isFinite(installationId)) {
    return fail('GitHub returned an invalid installation.');
  }

  const supabase = createServerClientSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== state.userId) {
    return fail('Your session changed. Please try connecting GitHub again.');
  }

  const admin = createAdminClient();
  if (!(await canManageRoomRepo(admin, state.roomId, user.id))) {
    return fail('You do not have permission to connect a repository to this room.');
  }

  try {
    const [installation, repos, roomRow] = await Promise.all([
      getInstallation(installationId),
      listInstallationRepos(installationId),
      admin.from('rooms').select('github_repo').eq('id', state.roomId).maybeSingle(),
    ]);

    if (repos.length === 0) {
      return fail(
        'No repositories are available. Choose at least one repository when installing the GitHub App.'
      );
    }

    const existingRepo = roomRow.data?.github_repo ?? null;
    const normalizedExisting = existingRepo?.toLowerCase() ?? null;

    const target =
      repos.length === 1
        ? repos[0]
        : repos.find(
            (repo) =>
              normalizedExisting !== null &&
              (repo.html_url.toLowerCase() === normalizedExisting ||
                repo.full_name.toLowerCase() === normalizedExisting)
          ) ?? null;

    const { error } = await admin
      .from('rooms')
      .update({
        github_installation_id: installationId,
        github_repo: target ? target.html_url : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', state.roomId);

    if (error) throw error;

    const message = target
      ? `Connected ${target.full_name}. Webhooks are now active for this room.`
      : `GitHub connected to ${installation.account.login}. Choose a repository below.`;

    return clearStateCookie(
      NextResponse.redirect(
        settingsUrl(origin, state.roomId, { github_connected: message })
      )
    );
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : 'Could not finish connecting GitHub.'
    );
  }
}
