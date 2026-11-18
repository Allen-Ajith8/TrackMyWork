import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomArtifactsClient } from '@/components/room-artifacts-client';
import { attachUser, loadRoomMembers } from '@/lib/room-relations';
import { getServerAuthUser, getFallbackDemoRoom, isAuthRequired } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

async function getRoomArtifacts(roomId: string) {
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
      return { room: demo.room, artifacts: demo.artifacts, members: demo.members };
    }
    return { room: null, artifacts: [], members: [] };
  }

  try {
    const members = await loadRoomMembers(supabase, roomId, { activeOnly: true });

    const { data: artifacts } = await supabase
      .from('artifacts')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    const transformedArtifacts = await attachUser({
      supabase,
      rows: artifacts || [],
      idField: 'uploaded_by',
      as: 'uploader',
    });

    return { room, artifacts: transformedArtifacts, members };
  } catch {
    if (!isAuthRequired()) {
      const demo = getFallbackDemoRoom(roomId);
      return { room: demo.room, artifacts: demo.artifacts, members: demo.members };
    }
    return { room, artifacts: [], members: [] };
  }
}

export default async function RoomArtifactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, artifacts, members } = await getRoomArtifacts(id);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/artifacts`);
  }

  return <RoomArtifactsClient room={room} initialArtifacts={artifacts} initialMembers={members} />;
}
