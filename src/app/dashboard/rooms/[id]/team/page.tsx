import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomTeamClient } from '@/components/room-team-client';
import { loadRoomMembers } from '@/lib/room-relations';
import { getServerAuthUser, getFallbackDemoRoom, isAuthRequired } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

async function getRoomTeam(roomId: string) {
  const supabase = createServerClientSupabase();

  let room: any = null;
  try {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    room = data;
  } catch {}

  if (!room) {
    if (!isAuthRequired() || roomId.startsWith('demo-')) {
      const demo = getFallbackDemoRoom(roomId);
      return { room: demo.room, members: demo.members };
    }
    return { room: null, members: [] };
  }

  try {
    const members = await loadRoomMembers(supabase, roomId, { activeOnly: false });
    return { room, members };
  } catch {
    if (!isAuthRequired()) {
      const demo = getFallbackDemoRoom(roomId);
      return { room: demo.room, members: demo.members };
    }
    return { room, members: [] };
  }
}

export default async function RoomTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, members } = await getRoomTeam(id);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/team`);
  }

  return <RoomTeamClient room={room} initialMembers={members} />;
}
