import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-data';
import { NewBomClient } from '@/components/new-bom-client';

export const dynamic = 'force-dynamic';

export default async function NewBomPage() {
  const { user, rooms } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/bom/new');
  }

  return <NewBomClient rooms={rooms.map((room) => ({ id: room.id, name: room.name }))} />;
}
