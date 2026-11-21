'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellRing,
  Check,
  Download,
  FolderKanban,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

interface SettingsClientProps {
  profile: {
    id: string;
    email: string;
    createdAt: string;
    lastSignInAt: string | null;
    displayName: string;
    username: string | null;
    headline: string;
    avatarUrl: string | null;
  };
  stats: {
    rooms: number;
    tasks: number;
    artifacts: number;
  };
}

export function SettingsClient({ profile, stats }: SettingsClientProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [signingOut, setSigningOut] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      new Notification('TrackMyWork', {
        body: 'Browser notifications are enabled for this device.',
      });
    }
  }

  async function handleSignOut(scope: 'local' | 'global') {
    setSigningOut(true);
    await supabase.auth.signOut({ scope });
    router.push('/auth/login');
  }

  function downloadData() {
    const payload = {
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        username: profile.username,
        headline: profile.headline,
        email: profile.email,
        createdAt: profile.createdAt,
        lastSignInAt: profile.lastSignInAt,
      },
      stats,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trackmywork-profile.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Settings</h1>
        <p className="text-surface-600 mt-1">Manage your account and workspace preferences.</p>
      </div>

      <section className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 overflow-hidden flex items-center justify-center flex-shrink-0">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-2xl font-bold text-primary-700">
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-surface-900 truncate">
              {profile.displayName}
            </h2>
            <p className="text-sm text-surface-500">
              {profile.username ? `@${profile.username}` : 'No username set'}
              {profile.headline ? ` · ${profile.headline}` : ''}
            </p>
            <p className="text-xs text-surface-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Member since {formatDate(profile.createdAt)}
            </p>
          </div>
          <Link href="/dashboard/profile" className="btn-primary">
            <UserRound className="w-4 h-4" />
            Edit profile
          </Link>
        </div>
      </section>

      <div className="grid sm:grid-cols-3 gap-4">
        <Link href="/dashboard/rooms" className="card p-5 hover:shadow-md transition-shadow">
          <FolderKanban className="w-5 h-5 text-primary-600" />
          <p className="text-2xl font-bold text-surface-900 mt-3">{stats.rooms}</p>
          <p className="text-sm text-surface-500">Rooms</p>
        </Link>
        <Link href="/dashboard/tasks" className="card p-5 hover:shadow-md transition-shadow">
          <p className="text-2xl font-bold text-surface-900">{stats.tasks}</p>
          <p className="text-sm text-surface-500 mt-1">Tasks across rooms</p>
        </Link>
        <Link href="/dashboard/artifacts" className="card p-5 hover:shadow-md transition-shadow">
          <p className="text-2xl font-bold text-surface-900">{stats.artifacts}</p>
          <p className="text-sm text-surface-500 mt-1">Artifacts uploaded</p>
        </Link>
      </div>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-surface-200">
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-600" />
            Notifications
          </h2>
          <p className="text-sm text-surface-500 mt-1">
            Choose how TrackMyWork keeps you updated on this device.
          </p>
        </div>
        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-medium text-surface-900">Browser notifications</p>
            <p className="text-sm text-surface-500 mt-0.5">
              Task assignments, deadlines and room alerts.
            </p>
            <p className="text-xs mt-1 text-surface-400 capitalize">
              Status: {permission === 'unsupported' ? 'not supported in this browser' : permission}
            </p>
          </div>
          <button
            type="button"
            onClick={enableNotifications}
            disabled={permission === 'granted' || permission === 'denied' || permission === 'unsupported'}
            className="btn-outline"
          >
            {permission === 'granted' ? <Check className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
            {permission === 'granted' ? 'Enabled' : 'Enable notifications'}
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-surface-200">
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary-600" />
            Account
          </h2>
          <p className="text-sm text-surface-500 mt-1">
            Your email is private and never shown in the sidebar or to teammates.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-sm text-surface-500">Email</span>
            <span className="text-sm text-surface-900 break-all">{profile.email}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-sm text-surface-500">Last sign-in</span>
            <span className="text-sm text-surface-900">
              {profile.lastSignInAt ? formatDate(profile.lastSignInAt) : '—'}
            </span>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-surface-200">
          <h2 className="font-semibold text-surface-900">Data & session</h2>
          <p className="text-sm text-surface-500 mt-1">
            Export your profile data or sign out of this device.
          </p>
        </div>
        <div className="p-5 flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={downloadData} className="btn-outline">
            <Download className="w-4 h-4" />
            Download my data
          </button>
          <button
            type="button"
            onClick={() => handleSignOut('local')}
            disabled={signingOut}
            className="btn-outline text-red-600 hover:bg-red-50"
          >
            {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Sign out
          </button>
          <button
            type="button"
            onClick={() => handleSignOut('global')}
            disabled={signingOut}
            className="btn-ghost text-red-600 hover:bg-red-50"
          >
            Sign out of all devices
          </button>
        </div>
      </section>
    </div>
  );
}
