'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { GlassIconTile } from '@/components/ui/glass-icons';
import { AnimatedList } from '@/components/ui/animated-list';
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
  created_by: '00000000-0000-0000-0000-000000000001',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const DEFAULT_DEMO_NOTIFICATIONS: (Notification & { roomName?: string | null })[] = [
  {
    id: 'notif-1',
    user_id: '00000000-0000-0000-0000-000000000001',
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
    user_id: '00000000-0000-0000-0000-000000000001',
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
  const router = useRouter();
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
    {
      name: 'Rooms',
      value: stats.rooms,
      icon: FolderKanban,
      glassColor: 'indigo',
      href: '/dashboard/rooms',
      bgClass: 'bg-gradient-to-br from-[#eff6ff] via-[#f8faff] to-[#eef2ff] border-blue-100/90 shadow-xs hover:border-blue-200 hover:shadow-md dark:bg-gradient-to-br dark:from-[#11192e] dark:via-[#0c1424] dark:to-[#080d19] dark:border-blue-900/50 dark:hover:border-blue-700/60 dark:shadow-blue-950/20',
      glowClass: 'bg-blue-400/20 dark:bg-blue-500/15',
      labelClass: 'text-surface-600 dark:text-slate-400',
      valueClass: 'text-surface-900 dark:text-white',
      textAccent: 'group-hover:text-indigo-600 dark:group-hover:text-indigo-300',
    },
    {
      name: 'Active Tasks',
      value: stats.activeTasks,
      icon: ClipboardList,
      glassColor: 'orange',
      href: '/dashboard/tasks',
      bgClass: 'bg-gradient-to-br from-[#fff7ed] via-[#fffbf5] to-[#ffedd5] border-amber-100/90 shadow-xs hover:border-amber-200 hover:shadow-md dark:bg-gradient-to-br dark:from-[#352511] dark:via-[#261909] dark:to-[#170e04] dark:border-amber-700/50 dark:hover:border-amber-600/70 dark:shadow-amber-950/20',
      glowClass: 'bg-amber-400/20 dark:bg-amber-500/20',
      labelClass: 'text-surface-600 dark:text-amber-200/70',
      valueClass: 'text-surface-900 dark:text-amber-400',
      textAccent: 'group-hover:text-orange-600 dark:group-hover:text-amber-300',
    },
    {
      name: 'Completed',
      value: stats.completedTasks,
      icon: CheckCircle,
      glassColor: 'green',
      href: '/dashboard/tasks?status=done',
      bgClass: 'bg-gradient-to-br from-[#ecfdf5] via-[#f6fef9] to-[#d1fae5] border-emerald-100/90 shadow-xs hover:border-emerald-200 hover:shadow-md dark:bg-gradient-to-br dark:from-[#0b281d] dark:via-[#071d15] dark:to-[#04120d] dark:border-emerald-700/50 dark:hover:border-emerald-600/70 dark:shadow-emerald-950/20',
      glowClass: 'bg-emerald-400/20 dark:bg-emerald-500/20',
      labelClass: 'text-surface-600 dark:text-emerald-200/70',
      valueClass: 'text-surface-900 dark:text-white',
      textAccent: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-300',
    },
    {
      name: 'BOM Items',
      value: stats.bomItems,
      icon: Package,
      glassColor: 'purple',
      href: '/dashboard/bom',
      bgClass: 'bg-gradient-to-br from-[#faf5ff] via-[#fdf4ff] to-[#f3e8ff] border-purple-100/90 shadow-xs hover:border-purple-200 hover:shadow-md dark:bg-gradient-to-br dark:from-[#26153c] dark:via-[#190d29] dark:to-[#0f071a] dark:border-purple-800/50 dark:hover:border-purple-600/70 dark:shadow-purple-950/20',
      glowClass: 'bg-purple-400/20 dark:bg-purple-500/20',
      labelClass: 'text-surface-600 dark:text-purple-200/70',
      valueClass: 'text-surface-900 dark:text-white',
      textAccent: 'group-hover:text-purple-600 dark:group-hover:text-purple-300',
    },
  ];

  const quickActions = [
    { name: 'Practice DSA with CodeTrack AI', href: '/dashboard/codetrack', icon: Zap, color: 'purple' },
    { name: 'Create Room', href: '/dashboard/rooms/new', icon: Plus, color: 'indigo' },
    { name: 'New Task', href: '/dashboard/tasks/new', icon: ClipboardList, color: 'orange' },
    { name: 'Add BOM Item', href: '/dashboard/bom/new', icon: Package, color: 'teal' },
    { name: 'Upload Artifact', href: '/dashboard/artifacts/upload', icon: FileImage, color: 'red' },
    { name: 'Manage Team', href: '/dashboard/team', icon: Users, color: 'pink' },
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
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Dashboard</h1>
          <p className="text-surface-600 dark:text-slate-400 mt-1">
            Welcome back, {user?.display_name || user?.username || 'Developer'}! Here's what's happening.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/codetrack"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-900 dark:border-purple-800/50 dark:bg-gradient-to-r dark:from-[#1a1426] dark:to-[#131020] dark:text-purple-200 font-semibold text-xs sm:text-sm hover:border-surface-300 dark:hover:border-purple-700 hover:shadow-xs transition-all duration-200"
          >
            <GlassIconTile icon={<Zap className="w-3.5 h-3.5 text-white" />} color="purple" size={26} plate="circle" />
            <span>Open CodeTrack AI</span>
          </Link>
          <Link href="/dashboard/rooms/new" className="btn-primary flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-md shadow-purple-950/40">
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
            className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${stat.bgClass}`}
          >
            {/* Ambient diffuse colored glow in top-right */}
            <div
              className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 ${stat.glowClass}`}
            />

            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className={`text-sm font-medium ${stat.labelClass}`}>{stat.name}</p>
                <p className={`text-3xl font-bold mt-1 transition-colors ${stat.valueClass} ${stat.textAccent}`}>
                  {stat.value}
                </p>
              </div>
              <div className="shrink-0 -mt-1 -mr-1 transition-transform duration-300 group-hover:scale-105">
                <GlassIconTile
                  icon={<stat.icon className="w-5 h-5 text-white" />}
                  color={stat.glassColor}
                  size={46}
                  roundness={0.58}
                  plate="tilt"
                  tilt={24}
                  hover="float"
                />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5 bg-white dark:bg-[#0d121f]/90 border border-surface-200 dark:border-slate-800/80 shadow-sm dark:shadow-xl">
            <h3 className="font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Quick Actions
            </h3>
            <AnimatedList
              items={quickActions.map((action, idx) => ({
                id: action.href,
                title: (
                  <span
                    className={cn(
                      'transition-colors font-medium',
                      idx === 0
                        ? 'text-purple-600 dark:text-purple-300 font-semibold'
                        : 'text-surface-800 dark:text-slate-200'
                    )}
                  >
                    {action.name}
                  </span>
                ),
                icon: (
                  <div className="shrink-0 transition-transform group-hover:scale-105">
                    <GlassIconTile
                      icon={<action.icon className="w-4 h-4 text-white" />}
                      color={action.color}
                      size={34}
                      roundness={0.55}
                      plate="offset"
                      hover="lift"
                    />
                  </div>
                ),
                href: action.href,
              }))}
              initialSelectedIndex={0}
              selectOnHover={true}
              enableArrowNavigation={true}
              radius={12}
              gap={8}
              onItemSelect={(item) => {
                if (item.href) router.push(item.href);
              }}
            />
          </div>
        </div>

        {/* Recent Activity & Notifications */}
        <div className="lg:col-span-2 space-y-4">
          {/* Notifications */}
          <div className="card dark:bg-[#0d121f]/90 dark:border-slate-800/80 dark:shadow-xl">
            <div className="p-4 border-b border-surface-200 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                Notifications
              </h3>
              <Link href="/dashboard/notifications" className="text-sm text-primary-600 dark:text-purple-400 hover:underline dark:hover:text-purple-300">
                View all
              </Link>
            </div>
            <div className="p-3">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-surface-500 dark:text-slate-400">
                  No notifications yet. You're all caught up!
                </div>
              ) : (
                <AnimatedList
                  items={notifications.slice(0, 5).map((notif) => ({
                    id: notif.id,
                    title: (
                      <span className="text-sm font-medium text-surface-900 dark:text-white">
                        {notif.title}
                      </span>
                    ),
                    description: formatRelativeTime(notif.created_at),
                    icon: (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-600 dark:bg-purple-500 shrink-0 mx-1" />
                    ),
                    href: notif.action_url || '/dashboard/notifications',
                  }))}
                  initialSelectedIndex={-1}
                  selectOnHover={true}
                  enableArrowNavigation={true}
                  radius={10}
                  gap={6}
                  onItemSelect={(item) => {
                    if (item.href) router.push(item.href);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
