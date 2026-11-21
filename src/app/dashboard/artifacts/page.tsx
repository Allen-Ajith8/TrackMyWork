import { redirect } from 'next/navigation';
import { getDashboardContext, isSupabaseConfigured, getFallbackDemoRoom } from '@/lib/dashboard-data';
import { ArtifactsOverviewClient } from '@/components/artifacts-overview-client';
import type { Artifact } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function ArtifactsPage() {
  const { supabase, user, rooms, roomIds } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/artifacts');
  }

  let artifacts: (Artifact & { roomName: string })[] = [];

  if (isSupabaseConfigured() && roomIds.length > 0) {
    try {
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
    } catch {
      // Supabase query error
    }
  }

  if (artifacts.length === 0) {
    const demo = getFallbackDemoRoom();
    artifacts = demo.artifacts.map((a) => ({
      ...a,
      roomName: rooms[0]?.name || 'Algorithm Mastery & CodeTrack',
    }));
  }

  return (
    <ArtifactsOverviewClient
      artifacts={artifacts}
      rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
    />
  );
}
