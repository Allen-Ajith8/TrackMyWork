import { redirect } from 'next/navigation';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { ProfileClient } from '@/components/profile-client';
import { getServerAuthUser } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/profile');
  }

  let dbProfile: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null = null;

  try {
    const { data } = await supabase
      .from('users')
      .select('display_name, username, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (data) dbProfile = data;
  } catch {
    // Table may not be exposed yet; auth metadata covers the profile.
  }

  if (!dbProfile) {
    dbProfile = {
      display_name: user.user_metadata?.display_name || 'Developer',
      username: user.user_metadata?.username || 'developer',
      avatar_url: null,
    };
  }

  return (
    <ProfileClient
      authUser={{
        id: user.id,
        email: user.email ?? '',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        metadata: user.user_metadata ?? {},
      }}
      initialProfile={dbProfile}
    />
  );
}
