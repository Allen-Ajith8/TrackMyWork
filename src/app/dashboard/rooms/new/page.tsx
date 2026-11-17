import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RoomCreationWizardClient } from '../../../../components/room-creation-wizard-client';

async function getUser() {
  const supabase = createServerClientSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export default async function RoomCreationPage() {
  const user = await getUser();
  
  if (!user) {
    redirect('/auth/login?redirect=/dashboard/rooms/new');
  }

  return <RoomCreationWizardClient />;
}
