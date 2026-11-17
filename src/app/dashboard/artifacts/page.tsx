import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-data';
import { ArtifactsOverviewClient } from '@/components/artifacts-overview-client';
import type { Artifact } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function ArtifactsPage() {
  const { supabase, user, rooms, roomIds } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/artifacts');
  }

  let artifacts: (Artifact & { roomName: string })[] = [];

  if (roomIds.length > 0) {
    const { data } = await supabase
      .from('artifacts')
      .select('*')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(200);

    const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
    artifacts = (data || []).map((artifact: Artifact) => ({
      ...artifact,
      roomName: roomNames.get(artifact.room_id) || 'Unknown room',
    }));
  }

  return (
    <ArtifactsOverviewClient
      artifacts={artifacts}
      rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
    />
  );
}
