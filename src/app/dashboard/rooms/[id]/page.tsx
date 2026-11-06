import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { RoomDashboardClient } from '@/components/room-dashboard-client';

async function getRoomData(roomId: string) {
  const supabase = createServerClientSupabase();

  // Get room with basic info
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    return { room: null, tasks: [], bom: [], artifacts: [], members: [] };
  }

  // Get members with user info
  const { data: members } = await supabase
    .from('room_members')
    .select('*, users(*)')
    .eq('room_id', roomId)
    .eq('status', 'active');

  // Get tasks with assignee info
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, assigned_to_user:users!tasks_assigned_to_fkey(*)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });

  // Get BOM items
  const { data: bom } = await supabase
    .from('hardware_bom')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });

  // Get artifacts
  const { data: artifacts } = await supabase
    .from('artifacts')
    .select('*, uploaded_by_user:users!artifacts_uploaded_by_fkey(*)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });

  // Transform tasks to include assignee
  const transformedTasks = (tasks || []).map((task: any) => ({
    ...task,
    assignee: task.assigned_to_user,
  }));

  return {
    room,
    tasks: transformedTasks,
    bom: bom || [],
    artifacts: artifacts || [],
    members: members || [],
  };
}

export default async function RoomDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, tasks, bom, artifacts, members } = await getRoomData(id);

  if (!room) {
    notFound();
  }

  // Check if user is a member (RLS will handle this, but we can do a quick check)
  const supabase = createServerClientSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}`);
  }

  return (
    <RoomDashboardClient
      room={room}
      initialTasks={tasks}
      initialBom={bom}
      initialArtifacts={artifacts}
      initialMembers={members}
    />
  );
}