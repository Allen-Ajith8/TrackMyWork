import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomCourtroomClient } from '@/components/room-courtroom-client';
import { getFallbackDemoRoom, isSupabaseConfigured } from '@/lib/dashboard-data';
import { cookies } from 'next/headers';

async function getCourtroomData(roomId: string) {
  // Demo mode: Supabase is not configured (or this is a demo room), so render
  // the courtroom from local fallback data instead of failing against a
  // placeholder Supabase URL.
  if (!isSupabaseConfigured() || roomId.startsWith('demo-')) {
    return { room: getFallbackDemoRoom(roomId).room, sessions: [] };
  }

  const supabase = createServerClientSupabase();
  try {
    const { data: room } = await supabase
      .from('rooms')
      .select('id, name, description')
      .eq('id', roomId)
      .single();

    if (!room) {
      return { room: null, sessions: [] };
    }

    // Try to fetch court sessions, but handle missing table gracefully
    let sessions: any[] = [];
    try {
      const { data: courtSessions, error } = await supabase
        .from('court_sessions')
        .select('id, motion, status, created_at, adopted_option_id, decision_options')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(25);
      
      if (!error && courtSessions) {
        sessions = courtSessions;
      }
    } catch {
      // Table might not exist, use empty sessions
      sessions = [];
    }

    return { room, sessions };
  } catch {
    return { room: null, sessions: [] };
  }
}

export default async function RoomCourtroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demoMode = !isSupabaseConfigured() || id.startsWith('demo-');
  
  console.log('[CourtroomPage] id:', id, 'demoMode:', demoMode);
  
  const { room, sessions } = await getCourtroomData(id);

  console.log('[CourtroomPage] room found:', !!room);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  // Always resolve the real authenticated Supabase user. Never fall back to
  // DEMO_DEVELOPER_USER (developer@codetrack.ai) — that caused the sidebar
  // user to ping-pong between the real user and the demo developer.
  const supabase = createServerClientSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/courtroom`);
  }

  console.log('[CourtroomPage] rendering with user:', authUser.id, 'demoMode:', demoMode);

  return (
    <RoomCourtroomClient
      room={room}
      currentUserId={authUser.id}
      initialSessions={sessions}
      demoMode={demoMode}
    />
  );
}
