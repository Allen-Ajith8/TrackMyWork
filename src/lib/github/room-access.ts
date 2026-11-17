import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * A room's repository connection may be managed by:
 * - the room creator,
 * - an active Team Leader,
 * - a member granted the "Edit Repository" permission,
 * - a global super-admin.
 */
export async function canManageRoomRepo(
  admin: AdminClient,
  roomId: string,
  userId: string
): Promise<boolean> {
  const [{ data: room }, { data: member }, { data: profile }] = await Promise.all([
    admin.from('rooms').select('created_by').eq('id', roomId).maybeSingle(),
    admin
      .from('room_members')
      .select('flag_is_team_leader, flag_can_edit_repo')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    admin.from('users').select('is_global_admin').eq('id', userId).maybeSingle(),
  ]);

  if (!room) return false;

  return (
    room.created_by === userId ||
    Boolean(member?.flag_is_team_leader) ||
    Boolean(member?.flag_can_edit_repo) ||
    Boolean(profile?.is_global_admin)
  );
}
