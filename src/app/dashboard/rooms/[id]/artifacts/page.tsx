import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomArtifactsClient } from '@/components/room-artifacts-client';
import { attachUser, loadRoomMembers } from '@/lib/room-relations';

async function getRoomArtifacts(roomId: string) {
  const supabase = createServerClientSupabase();

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (!room) return { room: null, artifacts: [], members: [] };

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
}

export default async function RoomArtifactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, artifacts, members } = await getRoomArtifacts(id);

  if (!room) {
    redirect('/dashboard/rooms');
  }

  const supabase = createServerClientSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/artifacts`);
  }

  return <RoomArtifactsClient room={room} initialArtifacts={artifacts} initialMembers={members} />;
}