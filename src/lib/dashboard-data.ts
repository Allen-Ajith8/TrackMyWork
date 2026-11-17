import { cache } from 'react';
import { createServerClientSupabase } from '@/lib/supabase/server';

/**
 * Guarantee the signed-in user has a public.users profile row.
 *
 * The database trigger that normally mirrors auth.users into public.users is
 * not always present in older deployments. Without this row, team pages and
 * invites cannot resolve the user, so we create it on first dashboard visit.
 */
async function ensureUserProfile(
  supabase: ReturnType<typeof createServerClientSupabase>,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
  }
) {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) return;

  const metadata = user.user_metadata ?? {};
  const email = user.email ?? '';
  const username = metadata.username || email.split('@')[0] || null;
  const displayName =
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    username;

  const { error } = await supabase.from('users').insert({
    id: user.id,
    email,
    username,
    display_name: displayName,
    avatar_url: metadata.avatar_url || metadata.picture || null,
  });

  // 23505 = unique violation: another request created the row first.
  if (error && error.code !== '23505') {
    console.error('Could not create user profile:', error);
  }
}

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

  await ensureUserProfile(supabase, user);

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
