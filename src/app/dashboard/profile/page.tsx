import { redirect } from 'next/navigation';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { ProfileClient } from '@/components/profile-client';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = createServerClientSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/profile');
  }

  // The public.users row is optional for OAuth accounts: auth metadata is the
  // source of truth for profile display. Read it only when available.
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
    // Table may not be exposed yet; auth metadata still covers the profile.
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
