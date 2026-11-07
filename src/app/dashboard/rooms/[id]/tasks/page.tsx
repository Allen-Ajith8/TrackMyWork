import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomTasksClient } from '@/components/room-tasks-client';
import { attachUser, loadRoomMembers } from '@/lib/room-relations';

async function getRoomTasks(roomId: string) {
  const supabase = createServerClientSupabase();

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (!room) return { room: null, tasks: [], members: [] };

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
}

export default async function RoomTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, tasks, members } = await getRoomTasks(id);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  const supabase = createServerClientSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/tasks`);
  }

  return <RoomTasksClient room={room} initialTasks={tasks} initialMembers={members} />;
}