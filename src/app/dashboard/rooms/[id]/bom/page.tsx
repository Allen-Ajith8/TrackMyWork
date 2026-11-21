import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomBomClient } from '@/components/room-bom-client';
import { loadRoomMembers } from '@/lib/room-relations';
import { getServerAuthUser, getFallbackDemoRoom, isAuthRequired } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

async function getRoomBom(roomId: string) {
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
      return { room: demo.room, bom: demo.bom, members: demo.members };
    }
    return { room: null, bom: [], members: [] };
  }

  try {
    const [members, bomResult] = await Promise.all([
      loadRoomMembers(supabase, roomId, { activeOnly: true }),
      supabase
        .from('hardware_bom')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false }),
    ]);

    return { room, bom: bomResult.data || [], members };
  } catch {
    if (!isAuthRequired()) {
      const demo = getFallbackDemoRoom(roomId);
      return { room: demo.room, bom: demo.bom, members: demo.members };
    }
    return { room, bom: [], members: [] };
  }
}

export default async function RoomBomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, bom, members } = await getRoomBom(id);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/bom`);
  }

  return <RoomBomClient room={room} initialBom={bom} initialMembers={members} />;
}
