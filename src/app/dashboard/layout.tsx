'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import { DEMO_DEVELOPER_USER } from '@/lib/constants';
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Package,
  FileImage,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  Zap,
  Eye,
  UserRound,
  Code2,
} from 'lucide-react';
import Link from 'next/link';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRoomStore, useNotificationStore, useUIStore, useTaskStore } from '@/lib/store';
import { LoadingScreen } from '@/components/loading-screen';
import { NotificationsBell } from '@/components/notifications-bell';
import { ThemeToggle } from '@/components/theme-toggle';
import { VibeRealtime } from '@/components/vibe-realtime';
import { HackTimer } from '@/components/hack-timer';
import { PanicModeToggle } from '@/components/panic-mode-toggle';
import { PanicModeBanner } from '@/components/panic-mode-banner';
import { userFromAuthUser } from '@/lib/profile';
import GlassSurface from '@/components/ui/glass-surface';
import { GlassIconTile } from '@/components/ui/glass-icons';
import { DUMMY_USER, DUMMY_ROOM, DUMMY_MEMBERS, DUMMY_TASKS } from '@/lib/dummy-data';

const avatarFallback = (value: string) => value.replace(/^@/, '').charAt(0).toUpperCase() || 'U';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: 'blue' },
  { name: 'CodeTrack AI', href: '/dashboard/codetrack', icon: Code2, color: 'purple' },
  { name: 'Rooms', href: '/dashboard/rooms', icon: FolderKanban, color: 'indigo' },
  { name: 'Tasks', href: '/dashboard/tasks', icon: ClipboardList, color: 'orange' },
  { name: 'BOM', href: '/dashboard/bom', icon: Package, color: 'teal' },
  { name: 'Artifacts', href: '/dashboard/artifacts', icon: FileImage, color: 'red' },
  { name: 'Team', href: '/dashboard/team', icon: Users, color: 'pink' },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, color: 'silver' },
];

function toStoredSession(session: Session | null) {
  return session
    ? {
        access_token: session.access_token,
        expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
      }
    : null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, session, setUser, setSession, clearAuth } = useAuthStore();
  const { setCurrentRoom, clearRoom } = useRoomStore();
  const { setNotifications } = useNotificationStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      const storedUser = useAuthStore.getState().user;
      if (!storedUser) {
        setUser(DEMO_DEVELOPER_USER);
      }
      return;
    }

    const syncUserProfile = async (authUser: import('@supabase/supabase-js').User) => {
      const base = userFromAuthUser(authUser);
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        if (dbUser) {
          setUser({ ...base, ...dbUser });
          return;
        }
      } catch {
        // Keep base user from auth metadata
      }
      setUser(base);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(toStoredSession(session));
        if (session?.user) {
          syncUserProfile(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        clearAuth();
        clearRoom();
        setNotifications([]);
        if (typeof document !== 'undefined') {
          document.cookie = 'trackmywork_user=; path=/; max-age=0; SameSite=Lax';
        }
        if (process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true') {
          router.push('/auth/login');
        }
      }
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) {
        setSession(toStoredSession(session));
        syncUserProfile(session.user);
      } else {
        const storedUser = useAuthStore.getState().user;
        if (!storedUser) {
          setUser(DEMO_DEVELOPER_USER);
          const currentRoom = useRoomStore.getState().currentRoom;
          if (!currentRoom) {
            setCurrentRoom(DUMMY_ROOM);
            useRoomStore.getState().setRoomMembers(DUMMY_MEMBERS);
            useRoomStore.getState().setPermissions(true, true);
            useTaskStore.getState().setTasks(DUMMY_TASKS);
          }
        }
      }
    }).catch(() => {
      const storedUser = useAuthStore.getState().user;
      if (!storedUser) {
        setUser(DEMO_DEVELOPER_USER);
        const currentRoom = useRoomStore.getState().currentRoom;
        if (!currentRoom) {
          setCurrentRoom(DUMMY_ROOM);
          useRoomStore.getState().setRoomMembers(DUMMY_MEMBERS);
          useRoomStore.getState().setPermissions(true, true);
          useTaskStore.getState().setTasks(DUMMY_TASKS);
        }
      }
    });

    // Keep the mobile drawer closed on small screens.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }

    return () => subscription.unsubscribe();
  }, [router, setUser, setSession, clearAuth, clearRoom, setNotifications, setSidebarOpen]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    clearAuth();
    clearRoom();
    setNotifications([]);
    if (typeof document !== 'undefined') {
      document.cookie = 'trackmywork_user=; path=/; max-age=0; SameSite=Lax';
    }
    router.push('/auth/login');
  };

  const activeUser = user || DEMO_DEVELOPER_USER;
  const displayName = activeUser.display_name || activeUser.username || activeUser.email?.split('@')[0] || 'User';
  const secondaryLabel = activeUser.email || (activeUser.username ? `@${activeUser.username}` : 'Member');

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-[#0b0f19] text-surface-900 dark:text-surface-100 transition-colors duration-200">
      <VibeRealtime />
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white/95 dark:bg-[#0d121f]/95 border-r border-surface-200/80 dark:border-slate-800/60 shadow-sm backdrop-blur-md transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full w-full min-h-0">
          {/* Logo */}
          <div className="flex items-center gap-3 h-16 px-4 border-b border-surface-200/60 dark:border-slate-800/60 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <GlassIconTile
                icon={<Zap className="w-5 h-5 text-white" />}
                color="purple"
                size={36}
                roundness={0.55}
                plate="tilt"
                tilt={28}
                hover="lift"
              />
              <span className="font-bold text-xl text-surface-900 dark:text-white tracking-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                TrackMyWork
              </span>
            </Link>
          </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-thin min-h-0">
              {navigation.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? 'bg-primary-500/12 text-primary-700 dark:bg-purple-950/40 dark:text-purple-300 dark:border dark:border-purple-800/40 font-semibold shadow-xs'
                        : 'text-surface-700 dark:text-slate-400 hover:bg-surface-100/70 dark:hover:bg-slate-800/40 hover:text-surface-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="shrink-0 transition-transform duration-200 group-hover:scale-105">
                      <GlassIconTile
                        icon={<item.icon className="w-4 h-4 text-white" />}
                        color={item.color}
                        size={32}
                        roundness={0.55}
                        plate={isActive ? 'tilt' : 'offset'}
                        tilt={isActive ? 28 : 16}
                        hover="lift"
                      />
                    </div>
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="p-4 border-t border-surface-200/60 dark:border-slate-800/60 shrink-0">
              <Link
                href="/dashboard/profile"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-lg p-1.5 -m-1 hover:bg-surface-900/5 dark:hover:bg-white/5 transition-colors"
                title="Edit your profile"
              >
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-purple-950/60 flex items-center justify-center overflow-hidden ring-2 ring-white dark:ring-purple-900/40 shadow-sm">
                  {activeUser.avatar_url ? (
                    <img src={activeUser.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-primary-700 dark:text-purple-300 font-semibold">
                      {avatarFallback(displayName)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-slate-400 truncate">{secondaryLabel}</p>
                </div>
              </Link>
              <div className="mt-3 space-y-1">
                <Link
                  href="/dashboard/profile"
                  onClick={() => setSidebarOpen(false)}
                  className="sidebar-link flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-sm text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-slate-800/50 dark:hover:text-white"
                >
                  <GlassIconTile icon={<UserRound className="w-3.5 h-3.5 text-white" />} color="blue" size={26} plate="circle" />
                  <span>Profile</span>
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setSidebarOpen(false)}
                  className="sidebar-link flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-sm text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-slate-800/50 dark:hover:text-white"
                >
                  <GlassIconTile icon={<Settings className="w-3.5 h-3.5 text-white" />} color="graphite" size={26} plate="circle" />
                  <span>Settings</span>
                </Link>
                <Link
                  href="/dashboard/help"
                  onClick={() => setSidebarOpen(false)}
                  className="sidebar-link flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-sm text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-slate-800/50 dark:hover:text-white"
                >
                  <GlassIconTile icon={<HelpCircle className="w-3.5 h-3.5 text-white" />} color="teal" size={26} plate="circle" />
                  <span>Help & Docs</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="sidebar-link w-full text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-950/30 flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-sm"
                >
                  <GlassIconTile icon={<LogOut className="w-3.5 h-3.5 text-white" />} color="red" size={26} plate="circle" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen relative overflow-x-hidden">
        {/* Soft pastel ambient background aura (Light mode watercolor glow, Dark mode subtle nebula) */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-20 -right-20 w-[55vw] h-[55vh] rounded-full bg-gradient-to-bl from-orange-200/35 via-amber-100/25 to-transparent dark:from-purple-950/20 dark:via-indigo-950/15 dark:to-transparent blur-3xl opacity-80" />
          <div className="absolute top-10 left-64 w-[45vw] h-[45vh] rounded-full bg-gradient-to-br from-purple-200/35 via-indigo-100/20 to-transparent dark:from-blue-950/15 dark:via-slate-900/10 dark:to-transparent blur-3xl opacity-75" />
          <div className="absolute bottom-0 right-1/4 w-[40vw] h-[40vh] rounded-full bg-gradient-to-t from-pink-200/25 via-rose-100/15 to-transparent dark:from-pink-950/10 dark:to-transparent blur-3xl opacity-60" />
        </div>

        {/* Top Bar */}
        <header className="sticky top-0 z-20 glass border-b border-surface-200/50 dark:border-slate-800/60 dark:bg-[#0b0f19]/80 backdrop-blur-md">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden btn-ghost p-2"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Hack-Timer and Panic Mode Toggle */}
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <HackTimer />
                <PanicModeToggle />
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              {/* Theme Toggle (Light/Dark) */}
              <ThemeToggle />

              {/* Notifications */}
              <NotificationsBell />

              {/* Global Admin Ghost Mode */}
              {activeUser.is_global_admin && (
                <Link href="/dashboard/admin" className="btn-ghost p-2 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/50">
                  <Eye className="w-5 h-5" />
                </Link>
              )}
            </div>
          </div>
          <PanicModeBanner />
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
