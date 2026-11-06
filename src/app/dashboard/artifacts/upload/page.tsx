import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-data';
import { UploadArtifactClient } from '@/components/upload-artifact-client';

export const dynamic = 'force-dynamic';

export default async function UploadArtifactPage() {
  const { user, rooms } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/artifacts/upload');
  }

  return (
    <UploadArtifactClient
      userId={user.id}
      rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
    />
  );
}
