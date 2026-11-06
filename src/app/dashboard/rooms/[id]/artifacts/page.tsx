import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomArtifactsClient } from '@/components/room-artifacts-client';

async function getRoomArtifacts(roomId: string) {
  const supabase = createServerClientSupabase();

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (!room) return { room: null, artifacts: [], members: [] };

  const { data: members } = await supabase
    .from('room_members')
    .select('*, users(*)')
    .eq('room_id', roomId)
    .eq('status', 'active');

  const { data: artifacts } = await supabase
    .from('artifacts')
    .select('*, uploaded_by_user:users!artifacts_uploaded_by_fkey(*)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });

  const transformedArtifacts = (artifacts || []).map((artifact: any) => ({
    ...artifact,
    uploader: artifact.uploaded_by_user,
  }));

  return { room, artifacts: transformedArtifacts, members: members || [] };
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