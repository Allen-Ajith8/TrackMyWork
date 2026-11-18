import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomCourtroomClient } from '@/components/room-courtroom-client';

async function getCourtroomData(roomId: string) {
  const supabase = createServerClientSupabase();

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
}

export default async function RoomCourtroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { room, sessions } = await getCourtroomData(id);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  const supabase = createServerClientSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/courtroom`);
  }

  return (
    <RoomCourtroomClient
      room={room}
      currentUserId={user.id}
      initialSessions={sessions}
    />
  );
}
