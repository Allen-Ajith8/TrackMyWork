'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useRoomStore, useTaskStore, useNotificationStore } from '@/lib/store';
import {
  FolderKanban,
  ClipboardList,
  Package,
  FileImage,
  Users,
  Plus,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { formatRelativeTime, cn } from '@/lib/utils';
import { DashboardSkeleton } from '@/components/page-skeletons';
import type { Room, Task, Notification } from '@/types/database';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { currentRoom, setCurrentRoom } = useRoomStore();
  const { tasks, setTasks } = useTaskStore();
  const { notifications, setNotifications } = useNotificationStore();
  const [stats, setStats] = useState({
    rooms: 0,
    activeTasks: 0,
    completedTasks: 0,
    bomItems: 0,
  });
  const [recentActivity, setRecentActivity] = useState<Array<{ type: string; title: string; time: string; room: string }>>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadDashboard() {
      if (!user) return;

      setLoading(true);

      try {
        // Get user's rooms
        const { data: memberships } = await supabase
          .from('room_members')
          .select('room_id, rooms(*)')
          .eq('user_id', user.id)
          .eq('status', 'active');

        const roomIds = memberships?.map((m: { room_id: string }) => m.room_id) || [];
        setStats((s) => ({ ...s, rooms: roomIds.length }));

        if (roomIds.length > 0) {
          // Get tasks
          const { data: tasksData } = await supabase
            .from('tasks')
            .select('*')
            .in('room_id', roomIds)
            .order('created_at', { ascending: false })
            .limit(50);

          if (tasksData) {
            setTasks(tasksData);
            setStats((s) => ({
              ...s,
              activeTasks: tasksData.filter((t: { status: string }) => !['done'].includes(t.status)).length,
              completedTasks: tasksData.filter((t: { status: string }) => t.status === 'done').length,
            }));
          }

          // Get BOM items
          const { data: bomData } = await supabase
            .from('hardware_bom')
            .select('id')
            .in('room_id', roomIds);
          setStats((s) => ({ ...s, bomItems: bomData?.length || 0 }));

          // Get recent notifications
          const { data: notifs } = await supabase
            .from('notifications')
            .select('*, rooms(name)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (notifs) setNotifications(notifs);

          // Keep the "current room" in sync with the rooms the user belongs to.
          // A room can be deleted or the user removed while the id is still
          // persisted in local storage.
          const memberRooms = (memberships || [])
            .map((membership: any) => membership.rooms)
            .filter(Boolean) as Room[];

          if (memberRooms.length === 0) {
            if (currentRoom) setCurrentRoom(null);
          } else if (!currentRoom || !memberRooms.some((room) => room.id === currentRoom.id)) {
            setCurrentRoom(memberRooms[0]);
          }
        }
      } catch (error) {
        console.error('Dashboard load error:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` },
        (payload: { eventType: string; new: Notification }) => {
          if (payload.eventType === 'INSERT') {
            useNotificationStore.getState().addNotification(payload.new as Notification);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentRoom, setCurrentRoom, setTasks, setNotifications, supabase]);

  const statCards = [
    { name: 'Rooms', value: stats.rooms, icon: FolderKanban, color: 'bg-blue-500', href: '/dashboard/rooms' },
    { name: 'Active Tasks', value: stats.activeTasks, icon: ClipboardList, color: 'bg-yellow-500', href: '/dashboard/tasks' },
    { name: 'Completed', value: stats.completedTasks, icon: CheckCircle, color: 'bg-green-500', href: '/dashboard/tasks?status=done' },
    { name: 'BOM Items', value: stats.bomItems, icon: Package, color: 'bg-purple-500', href: '/dashboard/bom' },
  ];

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
          <p className="text-surface-600 mt-1">
            Welcome back, {user?.display_name || user?.username || 'hacker'}! Here's what's happening.
          </p>
        </div>
        <Link href="/dashboard/rooms/new" className="btn-primary">
          <Plus className="w-5 h-5" />
          New Room
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="card p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-surface-600">{stat.name}</p>
                <p className="text-3xl font-bold text-surface-900 mt-1">{stat.value}</p>
              </div>
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', stat.color)}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary-600" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Link href="/dashboard/rooms/new" className="btn-outline w-full justify-start">
                <Plus className="w-5 h-5" />
                Create Room
              </Link>
              <Link href="/dashboard/tasks/new" className="btn-outline w-full justify-start">
                <ClipboardList className="w-5 h-5" />
                New Task
              </Link>
              <Link href="/dashboard/bom/new" className="btn-outline w-full justify-start">
                <Package className="w-5 h-5" />
                Add BOM Item
              </Link>
              <Link href="/dashboard/artifacts/upload" className="btn-outline w-full justify-start">
                <FileImage className="w-5 h-5" />
                Upload Artifact
              </Link>
              <Link href="/dashboard/team" className="btn-outline w-full justify-start">
                <Users className="w-5 h-5" />
                Manage Team
              </Link>
            </div>
          </div>

          {/* Current Room Context */}
          {currentRoom && (
            <div className="card p-5 border-primary-200">
              <h3 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary-600" />
                Current Room
              </h3>
              <Link href={`/dashboard/rooms/${currentRoom.id}`} className="block">
                <p className="font-medium text-surface-900">{currentRoom.name}</p>
                <p className="text-sm text-surface-500 mt-1">
                  {currentRoom.project_type} • {currentRoom.team_size} members
                </p>
              </Link>
              <div className="mt-4 pt-4 border-t border-surface-200">
                <Link href={`/dashboard/rooms/${currentRoom.id}/tasks`} className="btn-primary w-full text-sm py-2">
                  <ArrowRight className="w-4 h-4" />
                  View Room Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity & Notifications */}
        <div className="lg:col-span-2 space-y-4">
          {/* Notifications */}
          <div className="card">
            <div className="p-4 border-b border-surface-200 flex items-center justify-between">
              <h3 className="font-semibold text-surface-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Notifications
              </h3>
              <Link href="/dashboard/notifications" className="text-sm text-primary-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-surface-200">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-surface-500">
                  No notifications yet. You're all caught up!
                </div>
              ) : (
                notifications.slice(0, 5).map((notif) => (
                  <Link
                    key={notif.id}
                    href={notif.action_url || '#'}
                    className={cn(
                      'p-4 flex items-start gap-3 hover:bg-surface-50 transition-colors',
                      !notif.is_read && 'bg-primary-50/50'
                    )}
                  >
                    <div className={cn('w-2 h-2 rounded-full mt-2 flex-shrink-0', !notif.is_read && 'bg-primary-500') } />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm', !notif.is_read ? 'font-medium text-surface-900' : 'text-surface-600')}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {formatRelativeTime(notif.created_at)}
                        {(notif as Notification & { rooms?: { name: string } | null }).rooms?.name &&
                          ` • ${(notif as Notification & { rooms?: { name: string } | null }).rooms?.name}`}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="p-4 border-b border-surface-200 flex items-center justify-between">
              <h3 className="font-semibold text-surface-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Recent Activity
              </h3>
              <Link href="/dashboard/activity" className="text-sm text-primary-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-surface-200">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-surface-500">
                  No recent activity. Create a room to get started!
                </div>
              ) : (
                tasks.slice(0, 5).map((task) => (
                  <Link
                    key={task.id}
                    href={`/dashboard/rooms/${task.room_id}/tasks/${task.id}`}
                    className="p-4 flex items-center gap-3 hover:bg-surface-50 transition-colors"
                  >
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', {
                      'bg-gray-400': task.status === 'todo',
                      'bg-blue-500': task.status === 'in_progress',
                      'bg-yellow-500': task.status === 'review',
                      'bg-green-500': task.status === 'done',
                      'bg-red-500': task.status === 'blocked',
                    })} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 truncate">{task.title}</p>
                      <p className="text-xs text-surface-500">
                        {task.category} • {task.status.replace('_', ' ')}
                      </p>
                    </div>
                    <span className="text-xs text-surface-500">{formatRelativeTime(task.created_at)}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
