'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  Handshake,
  MessageSquare,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useNotificationStore } from '@/lib/store';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types/database';

type NotificationWithRoom = Notification & { roomName: string | null };

const TYPE_META: Record<string, { icon: typeof Bell; className: string }> = {
  invite: { icon: UserPlus, className: 'bg-blue-50 text-blue-600' },
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

export function NotificationsClient({
  initialNotifications,
}: {
  initialNotifications: NotificationWithRoom[];
}) {
  const supabase = createClient();
  const { user } = useAuthStore();
  const { setNotifications, markAsRead, markAllAsRead, removeNotification } = useNotificationStore();
  const [notifications, setLocalNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNotifications(
      notifications.map(({ roomName, ...notification }) => notification as Notification)
    );
    // Only sync the badge when the server-provided list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? notifications
        : notifications.filter((notification) => !notification.is_read),
    [notifications, filter]
  );

  async function handleMarkRead(notification: NotificationWithRoom) {
    if (notification.is_read) return;
    setLocalNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item))
    );
    markAsRead(notification.id);
    await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
  }

  async function handleMarkAll() {
    if (!user || unreadCount === 0) return;
    setBusy(true);
    setLocalNotifications((current) =>
      current.map((notification) => ({ ...notification, is_read: true }))
    );
    markAllAsRead();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setBusy(false);
  }

  async function handleDelete(notification: NotificationWithRoom) {
    setLocalNotifications((current) => current.filter((item) => item.id !== notification.id));
    removeNotification(notification.id);
    await supabase.from('notifications').delete().eq('id', notification.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Notifications</h1>
          <p className="text-surface-600 mt-1">
            {unreadCount === 0
              ? 'You are all caught up.'
              : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={unreadCount === 0 || busy}
          className="btn-outline"
        >
          <CheckCheck className="w-5 h-5" />
          Mark all as read
        </button>
      </div>

      <div className="flex gap-2">
        {(['all', 'unread'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border capitalize transition-colors',
              filter === value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
            )}
          >
            {value}
            <span className={cn('ml-2 text-xs', filter === value ? 'text-white/80' : 'text-surface-400')}>
              {value === 'all' ? notifications.length : unreadCount}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <BellOff className="w-14 h-14 mx-auto text-surface-300" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900">
            {notifications.length === 0 ? 'No notifications yet' : 'Nothing unread'}
          </h3>
          <p className="text-surface-500 mt-1 max-w-md mx-auto">
            {notifications.length === 0
              ? 'Invites, task updates and deadline reminders will show up here.'
              : 'You have read everything. Nice work!'}
          </p>
          <Link href="/dashboard" className="btn-outline mt-6">
            Back to dashboard
          </Link>
        </div>
      ) : (
        <div className="card divide-y divide-surface-200 overflow-hidden">
          {filtered.map((notification) => {
            const meta = iconFor(notification.type);
            const Icon = meta.icon;

            const body = (
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                    meta.className
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        'text-sm truncate',
                        notification.is_read
                          ? 'text-surface-600'
                          : 'font-semibold text-surface-900'
                      )}
                    >
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {formatRelativeTime(notification.created_at)}
                    {notification.roomName ? ` · ${notification.roomName}` : ''}
                  </p>
                  {typeof notification.content?.message === 'string' && (
                    <p className="text-sm text-surface-600 mt-1 line-clamp-2">
                      {notification.content.message}
                    </p>
                  )}
                </div>
              </div>
            );

            return (
              <div
                key={notification.id}
                className={cn(
                  'flex items-center gap-3 p-4 hover:bg-surface-50 transition-colors',
                  !notification.is_read && 'bg-primary-50/40'
                )}
              >
                {notification.action_url ? (
                  <Link
                    href={notification.action_url}
                    className="flex-1 min-w-0"
                    onClick={() => handleMarkRead(notification)}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(notification)}
                    className="flex-1 min-w-0 text-left"
                  >
                    {body}
                  </button>
                )}

                {!notification.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(notification)}
                    className="btn-ghost p-2 hidden sm:inline-flex"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(notification)}
                  className="btn-ghost p-2 text-red-600 hover:bg-red-50"
                  title="Delete notification"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="card p-5 flex items-start gap-3">
        <Handshake className="w-5 h-5 text-primary-600 mt-0.5" />
        <div>
          <h3 className="font-semibold text-surface-900">Stay in the loop</h3>
          <p className="text-sm text-surface-600 mt-1">
            Task assignments, NIM alerts, conflicts and deadline reminders are delivered here and
            in your room dashboards.
          </p>
        </div>
      </div>
    </div>
  );
}
