import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomCreationWizardClient } from '../../../../components/room-creation-wizard-client';
import { getServerAuthUser } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function RoomCreationPage() {
  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);
  
  if (!user) {
    redirect('/auth/login?redirect=/dashboard/rooms/new');
  }

  return <RoomCreationWizardClient />;
}
