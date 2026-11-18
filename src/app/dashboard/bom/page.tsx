import { redirect } from 'next/navigation';
import { getDashboardContext, isSupabaseConfigured, getFallbackDemoRoom } from '@/lib/dashboard-data';
import { BomOverviewClient } from '@/components/bom-overview-client';
import type { HardwareBomItem } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function BomPage() {
  const { supabase, user, rooms, roomIds } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/bom');
  }

  let items: (HardwareBomItem & { roomName: string })[] = [];

  if (isSupabaseConfigured() && roomIds.length > 0) {
    try {
      const { data } = await supabase
        .from('hardware_bom')
        .select('*')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false })
        .limit(300);

      const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
      items = (data || []).map((item: HardwareBomItem) => ({
        ...item,
        roomName: roomNames.get(item.room_id) || 'Unknown room',
      }));
    } catch {
      // Supabase query error
    }
  }

  if (items.length === 0) {
    const demo = getFallbackDemoRoom();
    items = demo.bom.map((b) => ({
      ...b,
      roomName: rooms[1]?.name || 'Hardware & IoT Track',
    }));
  }

  return (
    <BomOverviewClient
      items={items}
      rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
    />
  );
}
