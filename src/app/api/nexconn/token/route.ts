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

export const dynamic = 'force-dynamic';

type TokenBody = {
  roomId?: string;
};

export async function POST(req: NextRequest) {
  const supabase = createServerClientSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

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
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .maybeSingle(),
      admin
        .from('users')
        .select('display_name, username, avatar_url, is_global_admin')
        .eq('id', authUser.id)
        .maybeSingle(),
    ]);

  const isMember =
    Boolean(room) &&
    (membership?.status === 'active' ||
      room?.created_by === authUser.id ||
      Boolean(profile?.is_global_admin));

  if (!isMember) {
    return NextResponse.json(
      { error: 'You do not have access to this room.' },
      { status: 403 }
    );
  }

  const nexconnUserId = toNexconnUserId(authUser.id);
  const displayName =
    profile?.display_name ||
    profile?.username ||
    authUser.email?.split('@')[0] ||
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