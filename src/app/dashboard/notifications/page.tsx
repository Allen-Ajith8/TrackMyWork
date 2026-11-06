import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { NotificationsClient } from '@/components/notifications-client';
import type { Notification } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const supabase = createServerClientSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/notifications');
  }

  const { data } = await supabase
    .from('notifications')
    .select('*, rooms(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const notifications = (data || []).map((notification: any) => ({
    ...notification,
    roomName: notification.rooms?.name || null,
  })) as (Notification & { roomName: string | null })[];

  return <NotificationsClient initialNotifications={notifications} />;
}
