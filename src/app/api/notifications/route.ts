import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerAuthUser } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

type NotificationRow = {
  id: string;
  user_id: string;
  room_id: string | null;
  type: string;
  title: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
  rooms?: { name: string | null } | null;
};

type InviteStatusRow = {
  id: string;
  room_id: string;
  invitee_id: string;
  status: string;
} | null;

/**
 * GET /api/notifications
 *
 * Returns the logged-in user's recent notifications (newest first) + unreadCount,
 * enriched with current invite status from room_invitations so already
 * accepted/declined invites do not show active Accept buttons.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClientSupabase();
    const user = await getServerAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in.' }, { status: 401 });
    }

    const userId = user.id;

    // Fetch notifications for this user, newest first.
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*, rooms(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Notifications API] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to load notifications.' }, { status: 500 });
    }

    const rows = (notifications || []) as NotificationRow[];

    // Enrich each room_invite notification with its current invite status so
    // accepted/declined invites do not render active Accept/Decline buttons.
    const inviteIds = rows
      .filter((n) => n.type === 'room_invite' || n.type === 'invite')
      .map((n) => (n.metadata as Record<string, unknown> | null)?.invite_id)
      .filter(Boolean) as string[];

    let inviteStatusById: Record<string, string> = {};

    if (inviteIds.length > 0) {
      const admin = createAdminClient();
      const { data: inviteRows } = await admin
        .from('room_invitations')
        .select('id, status')
        .in('id', inviteIds);

      for (const row of inviteRows || []) {
        inviteStatusById[row.id] = row.status;
      }
    }

    const enriched = rows.map((n) => {
      const metadata = (n.metadata || {}) as Record<string, unknown>;
      const inviteId = String(metadata.invite_id || '');
      const currentInviteStatus = inviteIds.includes(inviteId)
        ? (inviteStatusById[inviteId] || 'pending')
        : null;

      return {
        id: n.id,
        user_id: n.user_id,
        room_id: n.room_id,
        type: n.type,
        title: n.title,
        content: n.content,
        metadata,
        is_read: n.is_read,
        action_url: n.action_url,
        created_at: n.created_at,
        roomName: (n.rooms as { name: string | null } | null)?.name || null,
        inviteId,
        inviteStatus: currentInviteStatus,
      };
    });

    const unreadCount = enriched.filter((n) => !n.is_read).length;

    return NextResponse.json({
      success: true,
      notifications: enriched,
      unreadCount,
    });
  } catch (error: any) {
    console.error('[Notifications API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error while loading notifications.' },
      { status: 500 }
    );
  }
}
