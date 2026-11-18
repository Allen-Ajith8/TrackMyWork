// ============================================================================
// TrackMyWork - AI Courtroom: Human Interjection
// Phase 4: POST /api/courtroom/interject
// Allows a live teammate to inject a message into the courtroom transcript.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type InterjectBody = {
  sessionId: string;
  message: string;
};

export async function POST(req: NextRequest) {
  const supabase = createServerClientSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as InterjectBody | null;
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: 'message is required.' }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: 'message must be at most 2,000 characters.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch session and verify room membership
  const { data: session } = await admin
    .from('court_sessions')
    .select('id, room_id, status, created_by')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Court session not found.' }, { status: 404 });
  }

  const [{ data: membership }, { data: profile }] = await Promise.all([
    admin
      .from('room_members')
      .select('status')
      .eq('room_id', session.room_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    admin.from('users').select('is_global_admin, display_name, username').eq('id', user.id).maybeSingle(),
  ]);

  const isMember =
    membership?.status === 'active' ||
    session.created_by === user.id ||
    Boolean(profile?.is_global_admin);

  if (!isMember) {
    return NextResponse.json({ error: 'You do not have access to this room.' }, { status: 403 });
  }

  // Only allow interjections during active phases
  const activeStatuses = ['routing', 'phase1_opening', 'phase2_rebuttals'];
  if (!activeStatuses.includes(session.status)) {
    return NextResponse.json(
      { error: `Cannot interject: court session is ${session.status}.` },
      { status: 400 }
    );
  }

  // Determine next turn_index
  const { data: existingTranscripts } = await admin
    .from('court_transcripts')
    .select('turn_index')
    .eq('session_id', sessionId)
    .order('turn_index', { ascending: false })
    .limit(1);

  const nextTurnIndex = (existingTranscripts?.[0]?.turn_index ?? -1) + 1;

  // Determine user display name for model_id prefix
  const userLabel = profile?.display_name || profile?.username || user.email || 'Teammate';

  // Insert human interjection transcript row
  const { error: insertError } = await admin.from('court_transcripts').insert({
    session_id: sessionId,
    phase: 'human_interjection',
    speaker_role: 'Human Teammate',
    model_id: `human:${userLabel}`,
    content: message,
    citations: [],
    turn_index: nextTurnIndex,
  });

  if (insertError) {
    return NextResponse.json({ error: 'Could not record interjection.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
