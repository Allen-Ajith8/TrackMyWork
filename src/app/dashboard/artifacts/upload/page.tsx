import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-data';
import { UploadArtifactClient } from '@/components/upload-artifact-client';

export const dynamic = 'force-dynamic';

export default async function UploadArtifactPage({
  searchParams,
}: {
  searchParams?: { room?: string | string[] };
}) {
  const { user, rooms } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/artifacts/upload');
  }

  const requestedRoom = Array.isArray(searchParams?.room)
    ? searchParams?.room[0]
    : searchParams?.room;

  return (
    <UploadArtifactClient
      userId={user.id}
      rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
      defaultRoomId={requestedRoom}
    />
  );
}
