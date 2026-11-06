import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomBomClient } from '@/components/room-bom-client';

async function getRoomBom(roomId: string) {
  const supabase = createServerClientSupabase();

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (!room) return { room: null, bom: [], members: [] };

  const { data: members } = await supabase
    .from('room_members')
    .select('*, users(*)')
    .eq('room_id', roomId)
    .eq('status', 'active');

  const { data: bom } = await supabase
    .from('hardware_bom')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });

  return { room, bom: bom || [], members: members || [] };
}

export default async function RoomBomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, bom, members } = await getRoomBom(id);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  const supabase = createServerClientSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/bom`);
  }

  return <RoomBomClient room={room} initialBom={bom} initialMembers={members} />;
}