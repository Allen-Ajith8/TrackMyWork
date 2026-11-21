'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
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

const DEFAULT_DEMO_ROOM: Room = {
  id: 'demo-room-001',
  name: 'Algorithm Mastery & CodeTrack',
  description: 'Competitive programming, LeetCode sprints, and algorithm practice room.',
  invite_code: 'CODE-2026',
  project_type: 'software',
  team_size: 4,
  hackathon_sheet_row_id: null,
  github_repo: 'codetrack/trackmywork',
  github_installation_id: null,
  is_setup_complete: true,
  jury_expectations: 'Fast, reliable, and clean implementation.',
  created_by: 'demo-dev-user-001',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const DEFAULT_DEMO_NOTIFICATIONS: (Notification & { roomName?: string | null })[] = [
  {
    id: 'notif-1',
    user_id: 'demo-dev-user-001',
    room_id: 'demo-room-001',
    type: 'task_assigned',
    title: 'New Task Assigned: LeetCode GraphQL Client',
    content: { message: 'You have been assigned to implement the LeetCode GraphQL runner.' },
    is_read: false,
    action_url: '/dashboard/codetrack',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    roomName: 'Algorithm Mastery & CodeTrack',
  },
  {
    id: 'notif-2',
    user_id: 'demo-dev-user-001',
    room_id: 'demo-room-001',
    type: 'nim_alert',
    title: 'AI DSA Mentor Debrief Ready',
    content: { message: 'Mentor feedback generated for #121 Best Time to Buy and Sell Stock.' },
    is_read: true,
    action_url: '/dashboard/codetrack',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    roomName: 'Algorithm Mastery & CodeTrack',
  },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { currentRoom, setCurrentRoom } = useRoomStore();
  const { tasks, setTasks } = useTaskStore();
  const { notifications, setNotifications } = useNotificationStore();

  const [stats, setStats] = useState({
    rooms: 2,
    activeTasks: 4,
    completedTasks: 8,
    bomItems: 2,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If currentRoom is not yet set, provide default demo room context immediately
    if (!currentRoom) {
      setCurrentRoom(DEFAULT_DEMO_ROOM);
    }
    if (notifications.length === 0) {
      setNotifications(DEFAULT_DEMO_NOTIFICATIONS as any);
    }

    // If Supabase is not configured, we keep the demo state without making network requests that hang
    if (!isSupabaseConfigured() || !user) {
      return;
    }

    const supabase = createClient();

    async function loadDashboard() {
      try {
        const { data: memberships } = await supabase
          .from('room_members')
          .select('room_id, rooms(*)')
          .eq('user_id', user!.id)
          .eq('status', 'active');

        const roomIds = memberships?.map((m: { room_id: string }) => m.room_id) || [];
        if (roomIds.length > 0) {
          setStats((s) => ({ ...s, rooms: roomIds.length }));

          const { data: tasksData } = await supabase
            .from('tasks')
            .select('*')
            .in('room_id', roomIds)
            .order('created_at', { ascending: false })
            .limit(50);

          if (tasksData && tasksData.length > 0) {
            setTasks(tasksData);
            setStats((s) => ({
              ...s,
              activeTasks: tasksData.filter((t: { status: string }) => !['done'].includes(t.status)).length,
              completedTasks: tasksData.filter((t: { status: string }) => t.status === 'done').length,
            }));
          }

          const { data: bomData } = await supabase
            .from('hardware_bom')
            .select('id')
            .in('room_id', roomIds);
          if (bomData) {
            setStats((s) => ({ ...s, bomItems: bomData.length }));
          }

          const { data: notifs } = await supabase
            .from('notifications')
            .select('*, rooms(name)')
            .eq('user_id', user!.id)
            .order('created_at', { ascending: false })
            .limit(10);
          if (notifs && notifs.length > 0) {
            setNotifications(notifs);
          }
        }
      } catch (error) {
        console.warn('Dashboard load error:', error);
      }
    }

    loadDashboard();
  }, [user?.id]);

  const statCards = [
    { name: 'Rooms', value: stats.rooms, icon: FolderKanban, color: 'bg-blue-500', href: '/dashboard/rooms' },
    { name: 'Active Tasks', value: stats.activeTasks, icon: ClipboardList, color: 'bg-yellow-500', href: '/dashboard/tasks' },
    { name: 'Completed', value: stats.completedTasks, icon: CheckCircle, color: 'bg-green-500', href: '/dashboard/tasks?status=done' },
    { name: 'BOM Items', value: stats.bomItems, icon: Package, color: 'bg-purple-500', href: '/dashboard/bom' },
  ];

  if (loading) {
    return <DashboardSkeleton />;
  }

  const activeRoom = currentRoom || DEFAULT_DEMO_ROOM;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
          <p className="text-surface-600 mt-1">
            Welcome back, {user?.display_name || user?.username || 'Developer'}! Here's what's happening.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/codetrack" className="btn-secondary flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-600" />
            <span>Open CodeTrack AI</span>
          </Link>
          <Link href="/dashboard/rooms/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>New Room</span>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="card p-5 hover:shadow-md transition-shadow group cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-surface-600">{stat.name}</p>
                <p className="text-3xl font-bold text-surface-900 mt-1 group-hover:text-primary-600 transition-colors">
                  {stat.value}
                </p>
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
              <Link href="/dashboard/codetrack" className="btn-outline w-full justify-start text-purple-600 border-purple-200 hover:bg-purple-50">
                <Zap className="w-5 h-5 text-purple-600" />
                Practice DSA with CodeTrack AI
              </Link>
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
          {activeRoom && (
            <div className="card p-5 border-primary-200">
              <h3 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary-600" />
                Current Room
              </h3>
              <Link href={`/dashboard/rooms/${activeRoom.id}`} className="block group">
                <p className="font-medium text-surface-900 group-hover:text-primary-600 transition-colors">
                  {activeRoom.name}
                </p>
                <p className="text-sm text-surface-500 mt-1">
                  {activeRoom.project_type} • {activeRoom.team_size} members
                </p>
              </Link>
              <div className="mt-4 pt-4 border-t border-surface-200">
                <Link href={`/dashboard/rooms/${activeRoom.id}/tasks`} className="btn-primary w-full text-sm py-2">
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
                    <div className="w-2 h-2 rounded-full bg-primary-600 mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900">{notif.title}</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {formatRelativeTime(notif.created_at)}
                      </p>
                    </div>
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
