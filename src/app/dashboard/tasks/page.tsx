import { redirect } from 'next/navigation';
import { getDashboardContext, isSupabaseConfigured, getFallbackDemoRoom } from '@/lib/dashboard-data';
import { TasksOverviewClient } from '@/components/tasks-overview-client';
import { DUMMY_TASKS, DUMMY_ROOM } from '@/lib/dummy-data';
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

  if (isSupabaseConfigured() && roomIds.length > 0) {
    try {
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
    } catch {
      // Supabase query error
    }
  }

  if (tasks.length === 0) {
    const demo = getFallbackDemoRoom();
    tasks = demo.tasks.map((t) => ({
      ...t,
      roomName: rooms[0]?.name || 'Algorithm Mastery & CodeTrack',
    }));
  }

  if (tasks.length === 0) {
    tasks = DUMMY_TASKS.map((task) => ({
      ...task,
      roomName: DUMMY_ROOM.name,
    }));
  }

  return (
    <TasksOverviewClient
      tasks={tasks}
      rooms={rooms.length > 0 ? rooms.map((room) => ({ id: room.id, name: room.name })) : [{ id: DUMMY_ROOM.id, name: DUMMY_ROOM.name }]}
      initialStatus={searchParams?.status || 'all'}
    />
  );
}
