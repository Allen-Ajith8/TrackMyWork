import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-data';
import { ActivityFeedClient, type ActivityEntry } from '@/components/activity-feed-client';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const { supabase, user, rooms, roomIds } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/activity');
  }

  let entries: ActivityEntry[] = [];

  if (roomIds.length > 0) {
    const [tasksResult, bomResult, artifactsResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, status, category, room_id, created_at')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false })
        .limit(80),
      supabase
        .from('hardware_bom')
        .select('id, component, quantity, status, room_id, created_at')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false })
        .limit(80),
      supabase
        .from('artifacts')
        .select('id, name, type, room_id, created_at')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false })
        .limit(80),
    ]);

    const roomNames = new Map(rooms.map((room) => [room.id, room.name]));

    const taskEntries: ActivityEntry[] = (tasksResult.data || []).map((task: any) => ({
      id: `task-${task.id}`,
      type: 'task',
      title: task.title,
      detail: `${task.status.replace('_', ' ')} · ${task.category}`,
      roomName: roomNames.get(task.room_id) || 'Unknown room',
      createdAt: task.created_at,
      href: `/dashboard/rooms/${task.room_id}/tasks/${task.id}`,
    }));

    const bomEntries: ActivityEntry[] = (bomResult.data || []).map((item: any) => ({
      id: `bom-${item.id}`,
      type: 'bom',
      title: item.component,
      detail: `${item.quantity} unit${item.quantity === 1 ? '' : 's'} · ${item.status}`,
      roomName: roomNames.get(item.room_id) || 'Unknown room',
      createdAt: item.created_at,
      href: `/dashboard/rooms/${item.room_id}/bom`,
    }));

    const artifactEntries: ActivityEntry[] = (artifactsResult.data || []).map((artifact: any) => ({
      id: `artifact-${artifact.id}`,
      type: 'artifact',
      title: artifact.name,
      detail: `${artifact.type} artifact`,
      roomName: roomNames.get(artifact.room_id) || 'Unknown room',
      createdAt: artifact.created_at,
      href: `/dashboard/rooms/${artifact.room_id}/artifacts`,
    }));

    entries = [...taskEntries, ...bomEntries, ...artifactEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  return <ActivityFeedClient entries={entries} hasRooms={rooms.length > 0} />;
}
