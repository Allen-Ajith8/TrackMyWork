import { redirect } from 'next/navigation';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { NotificationsClient } from '@/components/notifications-client';
import { getServerAuthUser } from '@/lib/dashboard-data';
import type { Notification } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/notifications');
  }

  let notifications: (Notification & { roomName: string | null })[] = [];
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*, rooms(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    notifications = (data || []).map((notification: any) => ({
      ...notification,
      roomName: notification.rooms?.name || null,
    })) as (Notification & { roomName: string | null })[];
  } catch {
    // Ignore query failure in offline demo mode
  }

  return <NotificationsClient initialNotifications={notifications} />;
}
