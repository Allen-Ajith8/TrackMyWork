import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getInstallation, listInstallationRepos } from '@/lib/github/app';
import { canManageRoomRepo } from '@/lib/github/room-access';

export const dynamic = 'force-dynamic';

/**
 * Returns the repositories available to the room's GitHub App installation so
 * the UI can show a picker when more than one repo was granted.
 */
export async function GET(req: NextRequest) {
  const roomId = new URL(req.url).searchParams.get('roomId');
  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId.' }, { status: 400 });
  }

  const supabase = createServerClientSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!(await canManageRoomRepo(admin, roomId, user.id))) {
    return NextResponse.json(
      { error: 'You do not have permission to manage this room.' },
      { status: 403 }
    );
  }

  const { data: room } = await admin
    .from('rooms')
    .select('github_installation_id')
    .eq('id', roomId)
    .maybeSingle();

  const installationId = room?.github_installation_id;
  if (!installationId) {
    return NextResponse.json(
      { error: 'GitHub is not connected to this room yet.' },
      { status: 400 }
    );
  }

  try {
    const [installation, repos] = await Promise.all([
      getInstallation(installationId),
      listInstallationRepos(installationId),
    ]);

    return NextResponse.json({
      account: installation.account.login,
      repos: repos.map((repo) => ({
        id: repo.id,
        full_name: repo.full_name,
        html_url: repo.html_url,
        private: repo.private,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not load repositories from GitHub.',
      },
      { status: 502 }
    );
  }
}
