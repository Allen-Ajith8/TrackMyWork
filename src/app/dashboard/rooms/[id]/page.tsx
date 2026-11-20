import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { RoomDashboardClient } from '@/components/room-dashboard-client';
import { attachUser, loadRoomMembers } from '@/lib/room-relations';
import { getServerAuthUser, getFallbackDemoRoom, isAuthRequired, isSupabaseConfigured } from '@/lib/dashboard-data';
import { getStoredRoomBundle } from '@/lib/room-storage';

export const dynamic = 'force-dynamic';

async function getRoomData(roomId: string) {
  // Check if room was created and stored in local persistent storage
  const customBundle = getStoredRoomBundle(roomId);
  if (customBundle) {
    return customBundle;
  }

  if (!isSupabaseConfigured() || roomId.startsWith('demo-')) {
    return getFallbackDemoRoom(roomId);
  }

  const supabase = createServerClientSupabase();

  // Get room with basic info
  let room: any = null;
  let roomError: any = null;
  try {
    const res = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    room = res.data;
    roomError = res.error;
  } catch (err) {
    roomError = err;
  }

  if (roomError || !room) {
    if (!isAuthRequired() || roomId.startsWith('demo-')) {
      return getFallbackDemoRoom(roomId);
    }
    return { room: null, tasks: [], bom: [], artifacts: [], members: [] };
  }

  try {
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
  } catch {
    if (!isAuthRequired()) {
      return getFallbackDemoRoom(roomId);
    }
    return { room, tasks: [], bom: [], artifacts: [], members: [] };
  }
}

export default async function RoomDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, tasks, bom, artifacts, members } = await getRoomData(id);

  if (!room) {
    notFound();
  }

  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);
  
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
