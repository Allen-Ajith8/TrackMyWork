import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-data';
import { attachUser } from '@/lib/room-relations';
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
      .select('*')
      .in('room_id', roomIds)
      .order('created_at', { ascending: true });

    const membersWithUsers = await attachUser({
      supabase,
      rows: members || [],
      idField: 'user_id',
      as: 'user',
    });

    const byRoom = new Map<string, TeamRoom['members']>();
    for (const member of membersWithUsers) {
      const list = byRoom.get(member.room_id) || [];
      list.push({
        id: member.id,
        userId: member.user_id,
        role: member.custom_role_name || member.role_title || 'Member',
        status: member.status,
        isTeamLeader: Boolean(member.flag_is_team_leader),
        user: member.user
          ? {
              id: member.user.id,
              displayName:
                member.user.display_name ||
                member.user.username ||
                (member.user.email || '').split('@')[0] ||
                'Member',
              username: member.user.username || null,
              avatarUrl: member.user.avatar_url || null,
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
