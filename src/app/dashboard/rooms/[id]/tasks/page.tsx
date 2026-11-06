import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomTasksClient } from '@/components/room-tasks-client';

async function getRoomTasks(roomId: string) {
  const supabase = createServerClientSupabase();

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (!room) return { room: null, tasks: [], members: [] };

  const { data: members } = await supabase
    .from('room_members')
    .select('*, users(*)')
    .eq('room_id', roomId)
    .eq('status', 'active');

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, assigned_to_user:users!tasks_assigned_to_fkey(*)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });

  const transformedTasks = (tasks || []).map((task: any) => ({
    ...task,
    assignee: task.assigned_to_user,
  }));

  return { room, tasks: transformedTasks, members: members || [] };
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