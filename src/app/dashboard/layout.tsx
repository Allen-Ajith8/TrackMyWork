'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
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
  Bell,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { useRoomStore, useNotificationStore, useUIStore } from '@/lib/store';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Rooms', href: '/dashboard/rooms', icon: FolderKanban },
  { name: 'Tasks', href: '/dashboard/tasks', icon: ClipboardList },
  { name: 'BOM', href: '/dashboard/bom', icon: Package },
  { name: 'Artifacts', href: '/dashboard/artifacts', icon: FileImage },
  { name: 'Team', href: '/dashboard/team', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

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
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session);
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            username: session.user.user_metadata.username,
            display_name: session.user.user_metadata.display_name,
            avatar_url: session.user.user_metadata.avatar_url,
            is_global_admin: session.user.user_metadata.is_global_admin || false,
            fcm_token: null,
            created_at: session.user.created_at,
            updated_at: new Date().toISOString(),
          });
        }
      } else if (event === 'SIGNED_OUT') {
        clearAuth();
        clearRoom();
        setNotifications([]);
        router.push('/auth/login');
      }
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser({
          id: session.user.id,
          email: session.user.email!,
          username: session.user.user_metadata.username,
          display_name: session.user.user_metadata.display_name,
          avatar_url: session.user.user_metadata.avatar_url,
          is_global_admin: session.user.user_metadata.is_global_admin || false,
          fcm_token: null,
          created_at: session.user.created_at,
          updated_at: new Date().toISOString(),
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [router, setUser, setSession, clearAuth, clearRoom, setNotifications]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (!user) {
    return null; // Will redirect via auth state change
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-surface-200 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 h-16 px-4 border-b border-surface-200">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-surface-900">TrackMyWork</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="p-4 border-t border-surface-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <span className="text-primary-700 font-semibold">
                    {user.display_name?.[0] || user.username?.[0] || user.email[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 truncate">
                  {user.display_name || user.username || user.email}
                </p>
                <p className="text-xs text-surface-500 truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Link href="/dashboard/settings" className="sidebar-link">
                <Settings className="w-5 h-5" />
                Settings
              </Link>
              <Link href="/dashboard/help" className="sidebar-link">
                <HelpCircle className="w-5 h-5" />
                Help & Docs
              </Link>
              <button onClick={handleSignOut} className="sidebar-link w-full text-red-600 hover:bg-red-50">
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {!sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 glass border-b border-surface-200/50">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden btn-ghost p-2"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex-1 lg:flex-none" />

            <div className="flex items-center gap-3">
              {/* Notifications */}
              <Link href="/dashboard/notifications" className="relative btn-ghost p-2">
                <Bell className="w-5 h-5 text-surface-600" />
              </Link>

              {/* Global Admin Ghost Mode */}
              {user.is_global_admin && (
                <Link href="/dashboard/admin" className="btn-ghost p-2 text-purple-600 hover:bg-purple-50">
                  <Eye className="w-5 h-5" />
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}