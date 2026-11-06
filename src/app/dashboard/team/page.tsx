import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-data';
import { TeamOverviewClient, type TeamRoom } from '@/components/team-overview-client';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const { supabase, user, rooms, roomIds } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/team');
  }

  let teamRooms: TeamRoom[] = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    inviteCode: room.invite_code,
    members: [],
  }));

  if (roomIds.length > 0) {
    const { data: members } = await supabase
      .from('room_members')
      .select('*, users(*)')
      .in('room_id', roomIds)
      .order('created_at', { ascending: true });

    const byRoom = new Map<string, TeamRoom['members']>();
    for (const member of members || []) {
      const list = byRoom.get(member.room_id) || [];
      list.push({
        id: member.id,
        userId: member.user_id,
        role: member.custom_role_name || member.role_title || 'Member',
        status: member.status,
        isTeamLeader: Boolean(member.flag_is_team_leader),
        user: member.users
          ? {
              id: member.users.id,
              displayName:
                member.users.display_name ||
                member.users.username ||
                (member.users.email || '').split('@')[0] ||
                'Member',
              username: member.users.username || null,
              avatarUrl: member.users.avatar_url || null,
            }
          : null,
      });
      byRoom.set(member.room_id, list);
    }

    teamRooms = teamRooms.map((room) => ({
      ...room,
      members: byRoom.get(room.id) || [],
    }));
  }

  return <TeamOverviewClient rooms={teamRooms} />;
}
