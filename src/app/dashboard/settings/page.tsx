import { redirect } from 'next/navigation';
import { getDashboardContext, isSupabaseConfigured } from '@/lib/dashboard-data';
import { getAvatarUrl, getDisplayName, getHeadline, getUsername, getProfileMetadata } from '@/lib/profile';
import { SettingsClient } from '@/components/settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { supabase, user, rooms, roomIds } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/settings');
  }

  let taskCount = 3;
  let artifactCount = 2;

  if (isSupabaseConfigured() && roomIds.length > 0) {
    try {
      const [tasksResult, artifactsResult] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('room_id', roomIds),
        supabase.from('artifacts').select('id', { count: 'exact', head: true }).in('room_id', roomIds),
      ]);
      taskCount = tasksResult.count || 0;
      artifactCount = artifactsResult.count || 0;
    } catch {}
  }

  const metadata = getProfileMetadata(user);

  return (
    <SettingsClient
      profile={{
        id: user.id,
        email: user.email ?? '',
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        displayName: getDisplayName(metadata, 'Member'),
        username: getUsername(metadata) || null,
        headline: getHeadline(metadata),
        avatarUrl: getAvatarUrl(metadata),
      }}
      stats={{
        rooms: rooms.length,
        tasks: taskCount,
        artifacts: artifactCount,
      }}
    />
  );
}
