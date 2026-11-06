import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-data';
import { TasksOverviewClient } from '@/components/tasks-overview-client';
import type { Task } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const { supabase, user, rooms, roomIds } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/tasks');
  }

  let tasks: (Task & { roomName: string })[] = [];

  if (roomIds.length > 0) {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(200);

    const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
    tasks = (data || []).map((task: Task) => ({
      ...task,
      roomName: roomNames.get(task.room_id) || 'Unknown room',
    }));
  }

  return (
    <TasksOverviewClient
      tasks={tasks}
      rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
      initialStatus={searchParams?.status || 'all'}
    />
  );
}
