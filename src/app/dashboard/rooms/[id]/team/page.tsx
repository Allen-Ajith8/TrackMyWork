import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomTeamClient } from '@/components/room-team-client';
import { loadRoomMembers } from '@/lib/room-relations';

async function getRoomTeam(roomId: string) {
  const supabase = createServerClientSupabase();

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (!room) return { room: null, members: [] };

  const members = await loadRoomMembers(supabase, roomId, { activeOnly: false });

  return { room, members };
}

export default async function RoomTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, members } = await getRoomTeam(id);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  const supabase = createServerClientSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/team`);
  }

  return <RoomTeamClient room={room} initialMembers={members} />;
}