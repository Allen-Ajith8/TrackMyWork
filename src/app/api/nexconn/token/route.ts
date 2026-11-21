// ============================================================================
// TrackMyWork - Nexconn Chat: Access Token
// POST /api/nexconn/token
// Verifies room access, then exchanges the Supabase identity for a Nexconn
// access token. Returns 503 (never throws) when keys are not configured.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getNexconnChannelId,
  toNexconnUserId,
} from '@/lib/nexconn/shared';
import {
  isNexconnConfigured,
  issueNexconnAccessToken,
} from '@/lib/nexconn/server';
import { isSupabaseConfigured } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

type TokenBody = {
  roomId?: string;
};

export async function POST(req: NextRequest) {
  // Check for dev mode cookie
  const cookieHeader = req.headers.get('cookie') || '';
  const isDevMode = cookieHeader.includes('trackmywork_dev_user=true') || !isSupabaseConfigured();

  if (!isNexconnConfigured()) {
    return NextResponse.json(
      {
        error: 'Nexconn Chat is not configured.',
        code: 'NEXCONN_NOT_CONFIGURED',
        missing: [
          'NEXT_PUBLIC_NEXCONN_APP_KEY',
          'NEXCONN_APP_SECRET',
        ],
      },
      { status: 503 }
    );
  }

  let user = null;
  if (isSupabaseConfigured()) {
    const supabase = createServerClientSupabase();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) user = authUser;
  }

  // Demo mode: allow anonymous access when Supabase is not configured or dev cookie is set
  if (!user && isDevMode) {
    user = {
      id: 'demo-dev-user-001',
      email: 'dev@trackmywork.local',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as TokenBody | null;
  const roomId = typeof body?.roomId === 'string' ? body.roomId.trim() : '';

  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const [{ data: room }, { data: membership }, { data: profile }] =
    await Promise.all([
      admin.from('rooms').select('id, created_by').eq('id', roomId).maybeSingle(),
      admin
        .from('room_members')
        .select('status')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
      admin
        .from('users')
        .select('display_name, username, avatar_url, is_global_admin')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

  const isMember =
    Boolean(room) &&
    (membership?.status === 'active' ||
      room?.created_by === user.id ||
      Boolean(profile?.is_global_admin));

  if (!isMember) {
    return NextResponse.json(
      { error: 'You do not have access to this room.' },
      { status: 403 }
    );
  }

  const nexconnUserId = toNexconnUserId(user.id);
  const displayName =
    profile?.display_name ||
    profile?.username ||
    user.email?.split('@')[0] ||
    'TrackMyWork member';

  try {
    const token = await issueNexconnAccessToken({
      userId: nexconnUserId,
      name: displayName,
      avatarUrl: profile?.avatar_url ?? null,
    });

    return NextResponse.json({
      token: token.accessToken,
      userId: token.userId || nexconnUserId,
      channelId: getNexconnChannelId(roomId),
    });
  } catch (error) {
    console.error('[Nexconn] Token issue failed:', error);
    return NextResponse.json(
      { error: 'Could not obtain a Nexconn access token.' },
      { status: 502 }
    );
  }
}
