'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  Handshake,
  Loader2,
  MessageSquare,
  UserPlus,
  X,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore, useNotificationStore } from '@/lib/store';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types/database';

type NotificationWithRoom = Notification & {
  roomName: string | null;
  inviteId: string | null;
  inviteStatus: 'pending' | 'accepted' | 'declined' | null;
};

const TYPE_META: Record<string, { icon: typeof Bell; className: string }> = {
  invite: { icon: UserPlus, className: 'bg-blue-50 text-blue-600' },
  room_invite: { icon: UserPlus, className: 'bg-blue-50 text-blue-600' },
  nim_alert: { icon: AlertTriangle, className: 'bg-amber-50 text-amber-600' },
  conflict: { icon: AlertTriangle, className: 'bg-red-50 text-red-600' },
  webhook: { icon: MessageSquare, className: 'bg-purple-50 text-purple-600' },
  task_assigned: { icon: Check, className: 'bg-blue-50 text-blue-600' },
  task_updated: { icon: CheckCheck, className: 'bg-green-50 text-green-600' },
  deadline: { icon: Clock, className: 'bg-orange-50 text-orange-600' },
  sos: { icon: AlertTriangle, className: 'bg-red-50 text-red-600' },
};

function iconFor(type: NotificationType) {
  return TYPE_META[type] || { icon: Bell, className: 'bg-surface-100 text-surface-600' };
}

/**
 * Bell button in the top bar. Clicking it opens a YouTube-style notifications
 * panel instead of navigating to a separate page.
 *
 * Notifications are loaded via GET /api/notifications and kept live through a
 * Supabase Realtime subscription on the `notifications` table (INSERT events
 * filtered by user_id). Pending room_invite items render Accept / Decline
 * buttons that call POST /api/invites/[inviteId]/respond.
 */
export function NotificationsBell() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const { user } = useAuthStore();
  const { unreadCount, setNotifications, markAsRead } = useNotificationStore();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationWithRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const next = (data.notifications || []) as NotificationWithRoom[];

      setItems(next);
      setNotifications(
        next.map(({ roomName, inviteId, inviteStatus, ...notification }) => ({
          ...notification,
        })) as Notification[]
      );
    } catch {
      // swallow - keep badge conservative
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, setNotifications]);

  // Load once on mount so the badge is accurate on every dashboard page, and
  // refresh whenever the panel is opened.
  useEffect(() => {
    void load();
  }, [load]);

  // Subscribe to live notification INSERT events for this user.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;

    const channelName = `notif-${userId}:${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const notification = payload.new as Notification & {
            metadata?: Record<string, unknown>;
            rooms?: { name: string | null } | null;
          };
          const enriched: NotificationWithRoom = {
            ...notification,
            roomName: notification.rooms?.name || null,
            inviteId:
              (notification.metadata?.invite_id as string | undefined) || null,
            inviteStatus: 'pending',
          };
          setItems((current) => [enriched, ...current].slice(0, 50));
          setNotifications([
            { ...notification } as Notification,
            ...useNotificationStore.getState().notifications,
          ]);
          void load();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleMarkRead(notification: NotificationWithRoom) {
    if (notification.is_read) return;
    setItems((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item
      )
    );
    markAsRead(notification.id);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id);
  }

  async function handleRespond(
    inviteId: string | null,
    action: 'accept' | 'decline'
  ) {
    if (!inviteId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/invites/${inviteId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        throw new Error('Failed to respond to invitation.');
      }
      const data = await res.json();

      setItems((current) =>
        current.map((item) =>
          item.inviteId === inviteId ? { ...item, is_read: true } : item
        )
      );
      markAsRead(inviteId);
      setOpen(false);

      if (action === 'accept' && data.roomId) {
        void router.push(`/dashboard/rooms/${data.roomId}`);
      }
    } catch {
      // error surfaced generically
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkAll() {
    if (!userId || unreadCount === 0) return;
    setBusy(true);
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setBusy(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn('relative btn-ghost p-2', open && 'bg-surface-100')}
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5 text-surface-600 dark:text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 z-[70] w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-surface-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-surface-200 dark:border-slate-800 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-surface-900 dark:text-white">
                Notifications
              </p>
              <p className="text-xs text-surface-500 dark:text-slate-400">
                {unreadCount === 0
                  ? 'You are all caught up'
                  : `${unreadCount} unread`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unreadCount === 0 || busy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-600 dark:text-purple-400 transition-colors hover:bg-primary-50 dark:hover:bg-purple-950/40 disabled:cursor-not-allowed disabled:text-surface-300 dark:disabled:text-slate-600"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              Mark all read
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-surface-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading notifications…
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-100 dark:bg-slate-800">
                  <BellOff className="w-6 h-6 text-surface-400 dark:text-slate-500" />
                </div>
                <p className="mt-3 text-sm font-medium text-surface-900 dark:text-white">
                  No notifications yet
                </p>
                <p className="mt-1 text-xs text-surface-500 dark:text-slate-400">
                  Invites, task updates and deadline reminders will show up here.
                </p>
              </div>
            ) : (
              items.map((notification) => {
                const meta = iconFor(notification.type as NotificationType);
                const Icon = meta.icon;
                const content = notification.content as
                  | Record<string, unknown>
                  | undefined;
                const message =
                  typeof content?.message === 'string'
                    ? content.message
                    : typeof notification.metadata?.message === 'string'
                      ? notification.metadata.message
                      : null;

                const isPendingInvite =
                  (notification.type === 'room_invite' ||
                    notification.type === 'invite') &&
                  notification.inviteStatus === 'pending';

                const body = (
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
                        meta.className
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            'truncate text-sm',
                            notification.is_read
                              ? 'text-surface-600 dark:text-slate-400'
                              : 'font-semibold text-surface-900 dark:text-white'
                          )}
                        >
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
                        )}
                      </div>
                      {message && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-surface-600 dark:text-slate-400">
                          {message}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-surface-500 dark:text-slate-400">
                        {formatRelativeTime(notification.created_at)}
                        {notification.roomName
                          ? ` · ${notification.roomName}`
                          : ''}
                      </p>

                      {isPendingInvite && (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              handleRespond(notification.inviteId, 'accept')
                            }
                            className="flex-1 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {busy ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              handleRespond(notification.inviteId, 'decline')
                            }
                            className="flex-1 items-center justify-center rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>

                    {isPendingInvite ? null : (
                      <button
                        type="button"
                        className="rounded p-1 text-surface-400 hover:text-surface-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleMarkRead(notification);
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );

                const itemClass = cn(
                  'flex w-full items-start px-4 py-3 text-left transition-colors hover:bg-surface-50 dark:hover:bg-slate-800/40',
                  !notification.is_read && 'bg-primary-50/40 dark:bg-purple-950/25'
                );

                const goToRoom =
                  notification.action_url ||
                  (notification.room_id
                    ? `/dashboard/rooms/${notification.room_id}`
                    : null);

                return goToRoom ? (
                  <Link
                    key={notification.id}
                    href={goToRoom}
                    className={itemClass}
                    onClick={(e) => {
                      if (isPendingInvite) {
                        e.preventDefault();
                      } else {
                        void handleMarkRead(notification);
                        setOpen(false);
                      }
                    }}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={notification.id}
                    type="button"
                    className={itemClass}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleMarkRead(notification);
                    }}
                  >
                    {body}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-surface-200 dark:border-slate-800 bg-surface-50 dark:bg-slate-900/80 px-4 py-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-surface-500 dark:text-slate-400">
              <Handshake className="w-3.5 h-3.5" />
              Updates from your rooms
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
