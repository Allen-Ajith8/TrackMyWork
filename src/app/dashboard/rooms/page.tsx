import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomsListClient } from '@/components/rooms-list-client';

async function getUserRooms() {
  const supabase = createServerClientSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { user: null, rooms: [] };

  const { data: memberships } = await supabase
    .from('room_members')
    .select('*, rooms(*)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  return {
    user,
    rooms: (memberships || []).map((m: any) => ({
      ...m.rooms,
      user_role: m.role_title,
      is_team_leader: m.flag_is_team_leader,
    })),
  };
}

export default async function RoomsListPage() {
  const { user, rooms } = await getUserRooms();
  
  if (!user) {
    redirect('/auth/login?redirect=/dashboard/rooms');
  }

  return <RoomsListClient user={user} rooms={rooms} />;
}