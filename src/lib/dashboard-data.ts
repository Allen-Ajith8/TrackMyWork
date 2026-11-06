import { cache } from 'react';
import { createServerClientSupabase } from '@/lib/supabase/server';

export interface DashboardRoom {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  project_type: string;
  team_size: number;
  created_at: string;
  [key: string]: unknown;
}

export const getDashboardContext = cache(async () => {
  const supabase = createServerClientSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      rooms: [] as DashboardRoom[],
      roomIds: [] as string[],
    };
  }

  const { data: memberships } = await supabase
    .from('room_members')
    .select('room_id, role_title, flag_is_team_leader, rooms(*)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const rooms = (memberships || [])
    .map((membership: any) => membership.rooms)
    .filter(Boolean) as DashboardRoom[];

  return {
    supabase,
    user,
    rooms,
    roomIds: rooms.map((room) => room.id),
  };
});
