import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomsListClient } from '@/components/rooms-list-client';
import { getServerAuthUser, DEMO_ROOMS, isSupabaseConfigured } from '@/lib/dashboard-data';
import { getAllCustomRooms } from '@/lib/room-storage';

export const dynamic = 'force-dynamic';

async function getUserRooms() {
  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);
  
  if (!user) return { user: null, rooms: [] };

  const customRooms = getAllCustomRooms();
  const mappedCustom = customRooms.map((r) => ({
    ...r,
    user_role: 'Team Leader',
    is_team_leader: true,
  }));

  if (!isSupabaseConfigured()) {
    return {
      user,
      rooms: [
        ...mappedCustom,
        ...DEMO_ROOMS.map((r) => ({
          ...r,
          user_role: 'Team Leader',
          is_team_leader: true,
        })),
      ],
    };
  }

  let rooms: any[] = [];
  try {
    const { data: memberships } = await supabase
      .from('room_members')
      .select('*, rooms(*)')
      .eq('user_id', user.id)
      .eq('status', 'active');

    rooms = (memberships || [])
      .map((m: any) => ({
        ...m.rooms,
        user_role: m.role_title,
        is_team_leader: m.flag_is_team_leader,
      }))
      .filter((r: any) => r && r.id);

    if (rooms.length === 0) {
      const { data: allRooms } = await supabase
        .from('rooms')
        .select('*')
        .limit(20);
      if (allRooms && allRooms.length > 0) {
        rooms = allRooms.map((r: any) => ({
          ...r,
          user_role: 'Team Leader',
          is_team_leader: true,
        }));
      }
    }
  } catch {
    // Ignore DB errors in demo mode
  }

  if (rooms.length === 0) {
    rooms = DEMO_ROOMS.map((r) => ({
      ...r,
      user_role: 'Team Leader',
      is_team_leader: true,
    }));
  }

  return {
    user,
    rooms,
  };
}

export default async function RoomsListPage() {
  const { user, rooms } = await getUserRooms();
  
  if (!user) {
    redirect('/auth/login?redirect=/dashboard/rooms');
  }

  return <RoomsListClient user={user} rooms={rooms} />;
}
