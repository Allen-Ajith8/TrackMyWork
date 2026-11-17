import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-data';
import { attachUser } from '@/lib/room-relations';
import { NewTaskClient, type RoomMemberOption } from '@/components/new-task-client';

export const dynamic = 'force-dynamic';

export default async function NewTaskPage() {
  const { supabase, user, rooms, roomIds } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/tasks/new');
  }

  const membersByRoom: Record<string, RoomMemberOption[]> = {};

  if (roomIds.length > 0) {
    const { data: members } = await supabase
      .from('room_members')
      .select('user_id, room_id, role_title, custom_role_name')
      .in('room_id', roomIds)
      .eq('status', 'active');

    const membersWithUsers = await attachUser({
      supabase,
      rows: members || [],
      idField: 'user_id',
      as: 'user',
    });

    for (const member of membersWithUsers) {
      const memberUser = member.user || {};
      const list = membersByRoom[member.room_id] || [];
      list.push({
        userId: member.user_id,
        name:
          memberUser.display_name ||
          memberUser.username ||
          (memberUser.email || '').split('@')[0] ||
          'Member',
        role: member.custom_role_name || member.role_title || 'Member',
      });
      membersByRoom[member.room_id] = list;
    }
  }

  return (
    <NewTaskClient
      userId={user.id}
      rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
      membersByRoom={membersByRoom}
    />
  );
}
