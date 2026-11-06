import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomDashboardLayoutClient } from '@/components/room-dashboard-layout-client';

async function getRoom(roomId: string) {
  const supabase = createServerClientSupabase();
  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();
  return room;
}

export default async function RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await getRoom(id);
  
  if (!room) {
    redirect('/dashboard/rooms');
  }

  return <RoomDashboardLayoutClient room={room}>{children}</RoomDashboardLayoutClient>;
}