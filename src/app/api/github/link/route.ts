import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listInstallationRepos } from '@/lib/github/app';
import { canManageRoomRepo } from '@/lib/github/room-access';
import { getServerAuthUser, isAuthRequired } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

type LinkBody = {
  roomId?: string;
  repoFullName?: string;
  action?: 'disconnect';
};

/**
 * Links a repository (chosen from the installation) to a room, or disconnects
 * the room from GitHub. Disconnecting only clears the room binding; it never
 * uninstalls the GitHub App.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as LinkBody | null;
  const roomId = body?.roomId;

  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId.' }, { status: 400 });
  }

  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const isDemo = roomId.startsWith('demo-') || !isAuthRequired();
  const admin = createAdminClient();
  if (!isDemo && !(await canManageRoomRepo(admin, roomId, user.id))) {
    return NextResponse.json(
      { error: 'You do not have permission to manage this room.' },
      { status: 403 }
    );
  }

  if (body?.action === 'disconnect') {
    if (!isDemo) {
      const { error } = await admin
        .from('rooms')
        .update({
          github_repo: null,
          github_installation_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roomId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  }

  const repoFullName = body?.repoFullName?.trim();
  if (!repoFullName) {
    return NextResponse.json(
      { error: 'Choose a repository to link.' },
      { status: 400 }
    );
  }

  const { data: room } = await admin
    .from('rooms')
    .select('github_installation_id')
    .eq('id', roomId)
    .maybeSingle();

  const installationId = room?.github_installation_id;
  if (!installationId) {
    // Direct repository link support without requiring GitHub App installation:
    const htmlUrl = repoFullName.startsWith('http')
      ? repoFullName
      : `https://github.com/${repoFullName}`;

    const { error: directError } = await admin
      .from('rooms')
      .update({
        github_repo: htmlUrl,
        github_installation_id: 1000001,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId);

    if (directError) {
      return NextResponse.json({ error: directError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      repo: { full_name: repoFullName, html_url: htmlUrl },
    });
  }

  try {
    const repos = await listInstallationRepos(installationId);
    const match = repos.find(
      (repo) => repo.full_name.toLowerCase() === repoFullName.toLowerCase()
    );

    if (!match) {
      return NextResponse.json(
        {
          error:
            'That repository is not accessible to this GitHub App installation. Reconnect GitHub and grant access to it.',
        },
        { status: 404 }
      );
    }

    const { error } = await admin
      .from('rooms')
      .update({
        github_repo: match.html_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      repo: { full_name: match.full_name, html_url: match.html_url },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not link that repository.',
      },
      { status: 502 }
    );
  }
}
