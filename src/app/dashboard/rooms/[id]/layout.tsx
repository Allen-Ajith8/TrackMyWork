import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomDashboardLayoutClient } from '@/components/room-dashboard-layout-client';
import { getFallbackDemoRoom, isAuthRequired, isSupabaseConfigured } from '@/lib/dashboard-data';

async function getRoom(roomId: string) {
  if (!isSupabaseConfigured() || roomId.startsWith('demo-')) {
    return getFallbackDemoRoom(roomId).room;
  }

  const supabase = createServerClientSupabase();
  try {
    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (room) return room;
  } catch {
    // Supabase query error in demo mode
  }

  if (!isAuthRequired() || roomId.startsWith('demo-')) {
    return getFallbackDemoRoom(roomId).room;
  }

  return null;
}

export default async function RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await getRoom(id);
  
  if (!room) {
    redirect('/dashboard/rooms');
  }

  return <RoomDashboardLayoutClient room={room}>{children}</RoomDashboardLayoutClient>;
}
