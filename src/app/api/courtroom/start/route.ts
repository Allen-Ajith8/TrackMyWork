// ============================================================================
// TrackMyWork - AI Courtroom: Start Trial
// Phase 4: POST /api/courtroom/start
// Kicks off a LangGraph courtroom trial asynchronously and returns immediately.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runCourtroomSession } from '@/lib/courtroom/graph';
import { isSupabaseConfigured } from '@/lib/dashboard-data';
import { waitUntil } from '@vercel/functions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type StartBody = {
  roomId: string;
  motion: string;
  repoContext?: Record<string, unknown>;
  fastDemoMode?: boolean;
};

export async function POST(req: NextRequest) {
  // Check for dev mode cookie
  const cookieHeader = req.headers.get('cookie') || '';
  const isDevMode = cookieHeader.includes('trackmywork_dev_user=true') || !isSupabaseConfigured();

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
    // Create a demo user for the trial
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

  const body = (await req.json().catch(() => null)) as StartBody | null;
  const roomId = typeof body?.roomId === 'string' ? body.roomId.trim() : '';
  const motion = typeof body?.motion === 'string' ? body.motion.trim() : '';
  const repoContext =
    body?.repoContext && typeof body.repoContext === 'object'
      ? body.repoContext
      : {};
  const fastDemoMode = typeof body?.fastDemoMode === 'boolean' ? body.fastDemoMode : false;

  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required.' }, { status: 400 });
  }

  if (!motion) {
    return NextResponse.json({ error: 'motion is required.' }, { status: 400 });
  }

  if (motion.length > 4000) {
    return NextResponse.json({ error: 'motion must be at most 4,000 characters.' }, { status: 400 });
  }

  // In demo mode, skip Supabase room membership checks
  let room: { id: string; created_by: string } | null = null;
  const admin = createAdminClient();
  if (!isDevMode) {
    // Verify room membership
    const [{ data: membership }, { data: profile }, { data: roomData }] = await Promise.all([
      admin
        .from('room_members')
        .select('status')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
      admin.from('users').select('is_global_admin').eq('id', user.id).maybeSingle(),
      admin.from('rooms').select('id, created_by').eq('id', roomId).maybeSingle(),
    ]);

    room = roomData;
    const isMember =
      membership?.status === 'active' ||
      room?.created_by === user.id ||
      Boolean(profile?.is_global_admin);

    if (!isMember || !room) {
      return NextResponse.json({ error: 'You do not have access to this room.' }, { status: 403 });
    }
  } else {
    // Demo mode: fetch room from database but skip membership checks
    const { data: roomData } = await admin.from('rooms').select('id, created_by').eq('id', roomId).maybeSingle();
    room = roomData;
  }

  if (!room) {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  }

  // Insert court_sessions row
  const { data: session, error: sessionError } = await admin
    .from('court_sessions')
    .insert({
      room_id: roomId,
      created_by: user.id,
      motion,
      repo_context: repoContext,
      status: 'routing',
    })
    .select('id, room_id, motion, status, created_at')
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: 'Could not create court session.' },
      { status: 500 }
    );
  }

  // Kick off LangGraph trial in the background (non-blocking).
  // Next.js 14.2.7 does not have next/after(), so we use waitUntil to keep the
  // serverless function alive while the LangGraph trial runs.
  waitUntil(
    runCourtroomSession({
      sessionId: session.id,
      roomId,
      motion,
      repoContext,
      fastDemoMode,
    }).catch(async (err) => {
      console.error('[Courtroom] Trial failed:', err);
      await admin
        .from('court_sessions')
        .update({ status: 'failed', error_message: String(err), updated_at: new Date().toISOString() })
        .eq('id', session.id);
    })
  );

  return NextResponse.json({
    sessionId: session.id,
    status: 'routing',
  });
}