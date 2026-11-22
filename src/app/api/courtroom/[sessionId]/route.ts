// ============================================================================
// TrackMyWork - AI Courtroom: Session Hydrator
// Phase 4: GET /api/courtroom/[sessionId]
// Returns the full courtroom state (session, transcripts, petitions) for
// initial page load / rehydration.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const supabase = createServerClientSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const sessionId = params.sessionId;

  const admin = createAdminClient();

  // Fetch session
  const { data: session, error: sessionError } = await admin
    .from('court_sessions')
    .select('id, room_id, created_by, motion, repo_context, status, witness_flags, phase2_grants_used, debate_summary, key_tensions, decision_options, adopted_option_id, error_message, created_at, updated_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Court session not found.' }, { status: 404 });
  }

  // Verify room membership
  const [{ data: membership }, { data: profile }] = await Promise.all([
    admin
      .from('room_members')
      .select('status')
      .eq('room_id', session.room_id)
      .eq('user_id', authUser.id)
      .eq('status', 'active')
      .maybeSingle(),
    admin.from('users').select('is_global_admin').eq('id', authUser.id).maybeSingle(),
  ]);

  const isMember =
    membership?.status === 'active' ||
    session.created_by === authUser.id ||
    Boolean(profile?.is_global_admin);

  if (!isMember) {
    return NextResponse.json({ error: 'You do not have access to this room.' }, { status: 403 });
  }

  // Fetch transcripts ordered by turn_index
  const { data: transcripts } = await admin
    .from('court_transcripts')
    .select('id, phase, speaker_role, model_id, content, citations, turn_index, created_at')
    .eq('session_id', sessionId)
    .order('turn_index', { ascending: true });

  // Fetch petitions ordered by round_number and created_at
  const { data: petitions } = await admin
    .from('court_petitions')
    .select('id, round_number, speaker_role, wants_floor, grounds, target_role, justification, judge_decision, judge_reason, created_at')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: true })
    .order('created_at', { ascending: true });

  return NextResponse.json({
    session: {
      id: session.id,
      room_id: session.room_id,
      created_by: session.created_by,
      motion: session.motion,
      repo_context: session.repo_context,
      status: session.status,
      witness_flags: session.witness_flags,
      phase2_grants_used: session.phase2_grants_used,
      debate_summary: session.debate_summary,
      key_tensions: session.key_tensions,
      decision_options: session.decision_options,
      adopted_option_id: session.adopted_option_id,
      error_message: session.error_message,
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
    transcripts: (transcripts ?? []).map((t) => ({
      id: t.id,
      phase: t.phase,
      speakerRole: t.speaker_role,
      modelId: t.model_id,
      content: t.content,
      citations: t.citations,
      turnIndex: t.turn_index,
      createdAt: t.created_at,
    })),
    petitions: (petitions ?? []).map((p) => ({
      id: p.id,
      roundNumber: p.round_number,
      speakerRole: p.speaker_role,
      wantsFloor: p.wants_floor,
      grounds: p.grounds,
      targetRole: p.target_role,
      justification: p.justification,
      judgeDecision: p.judge_decision,
      judgeReason: p.judge_reason,
      createdAt: p.created_at,
    })),
  });
}