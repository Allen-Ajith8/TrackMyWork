import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomCourtroomClient } from '@/components/room-courtroom-client';
import { getFallbackDemoRoom, isSupabaseConfigured } from '@/lib/dashboard-data';
import { DEMO_DEVELOPER_USER } from '@/lib/constants';
import type { User } from '@/types/database';

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

    const { data: sessions } = await supabase
      .from('court_sessions')
      .select('id, motion, status, created_at, adopted_option_id, decision_options')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(25);

    return { room, sessions: sessions ?? [] };
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
  const { room, sessions } = await getCourtroomData(id);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  let user: User;
  if (demoMode) {
    user = DEMO_DEVELOPER_USER;
  } else {
    const supabase = createServerClientSupabase();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      redirect(`/auth/login?redirect=/dashboard/rooms/${id}/courtroom`);
    }
    user = authUser as unknown as User;
  }

  return (
    <RoomCourtroomClient
      room={room}
      currentUserId={user.id}
      initialSessions={sessions}
      demoMode={demoMode}
    />
  );
}
