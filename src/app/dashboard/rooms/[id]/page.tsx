import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { RoomDashboardClient } from '@/components/room-dashboard-client';
import { attachUser, loadRoomMembers } from '@/lib/room-relations';

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

  const [members, tasksResult, bomResult, artifactsResult] = await Promise.all([
    loadRoomMembers(supabase, roomId, { activeOnly: true }),
    supabase
      .from('tasks')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false }),
    supabase
      .from('hardware_bom')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false }),
    supabase
      .from('artifacts')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false }),
  ]);

  const transformedTasks = await attachUser({
    supabase,
    rows: tasksResult.data || [],
    idField: 'assigned_to',
    as: 'assignee',
  });

  const transformedArtifacts = await attachUser({
    supabase,
    rows: artifactsResult.data || [],
    idField: 'uploaded_by',
    as: 'uploader',
  });

  return {
    room,
    tasks: transformedTasks,
    bom: bomResult.data || [],
    artifacts: transformedArtifacts,
    members,
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