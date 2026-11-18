import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomTasksClient } from '@/components/room-tasks-client';
import { attachUser, loadRoomMembers } from '@/lib/room-relations';
import { getServerAuthUser, getFallbackDemoRoom, isAuthRequired } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

async function getRoomTasks(roomId: string) {
  const supabase = createServerClientSupabase();

  let room: any = null;
  try {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    room = data;
  } catch {}

  if (!room) {
    if (!isAuthRequired() || roomId.startsWith('demo-')) {
      const demo = getFallbackDemoRoom(roomId);
      return { room: demo.room, tasks: demo.tasks, members: demo.members };
    }
    return { room: null, tasks: [], members: [] };
  }

  try {
    const members = await loadRoomMembers(supabase, roomId, { activeOnly: true });

    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    const transformedTasks = await attachUser({
      supabase,
      rows: tasks || [],
      idField: 'assigned_to',
      as: 'assignee',
    });

    return { room, tasks: transformedTasks, members };
  } catch {
    if (!isAuthRequired()) {
      const demo = getFallbackDemoRoom(roomId);
      return { room: demo.room, tasks: demo.tasks, members: demo.members };
    }
    return { room, tasks: [], members: [] };
  }
}

export default async function RoomTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, tasks, members } = await getRoomTasks(id);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/tasks`);
  }

  return <RoomTasksClient room={room} initialTasks={tasks} initialMembers={members} />;
}
