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
  Clock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import { GlassIconTile } from '@/components/ui/glass-icons';

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
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Settings</h1>
        <p className="text-surface-600 dark:text-slate-400 mt-1">
          Manage your account and workspace preferences.
        </p>
      </div>

      {/* Profile Card */}
      <section className="rounded-2xl border border-surface-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold shadow-md shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{profile.displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-surface-900 dark:text-white truncate">
                {profile.displayName}
              </h2>
              <p className="text-sm text-surface-500 dark:text-slate-400">
                {profile.username ? `@${profile.username}` : '@developer'}
                {profile.headline ? ` · ${profile.headline}` : ''}
              </p>
              <p className="text-xs text-surface-400 dark:text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                <span>Member since {formatDate(profile.createdAt)}</span>
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/profile"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] shadow-sm hover:shadow transition-all shrink-0"
          >
            <UserRound className="w-4 h-4" />
            <span>Edit profile</span>
          </Link>
        </div>
      </section>

      {/* 3 Metric Stat Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Rooms Card */}
        <Link
          href="/dashboard/rooms"
          className="rounded-2xl border border-surface-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-pointer"
        >
          <div className="shrink-0 mb-3">
            <GlassIconTile
              icon={<FolderKanban className="w-4 h-4 text-white" />}
              color="indigo"
              size={34}
              roundness={0.55}
              plate="tilt"
              tilt={24}
              hover="float"
            />
          </div>
          <p className="text-2xl font-bold text-surface-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {stats.rooms}
          </p>
          <p className="text-sm text-surface-500 dark:text-slate-400 mt-0.5">Rooms</p>
        </Link>

        {/* Tasks Card */}
        <Link
          href="/dashboard/tasks"
          className="rounded-2xl border border-surface-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-pointer flex flex-col justify-end min-h-[120px]"
        >
          <p className="text-2xl font-bold text-surface-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {stats.tasks}
          </p>
          <p className="text-sm text-surface-500 dark:text-slate-400 mt-0.5">Tasks across rooms</p>
        </Link>

        {/* Artifacts Card */}
        <Link
          href="/dashboard/artifacts"
          className="rounded-2xl border border-surface-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-pointer flex flex-col justify-end min-h-[120px]"
        >
          <p className="text-2xl font-bold text-surface-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {stats.artifacts}
          </p>
          <p className="text-sm text-surface-500 dark:text-slate-400 mt-0.5">Artifacts uploaded</p>
        </Link>
      </div>

      {/* Notifications Card */}
      <section className="rounded-2xl border border-surface-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs overflow-hidden">
        <div className="p-5 border-b border-surface-200/60 dark:border-slate-800/80">
          <h2 className="font-semibold text-base text-surface-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Notifications</span>
          </h2>
          <p className="text-sm text-surface-500 dark:text-slate-400 mt-0.5">
            Choose how TrackMyWork keeps you updated on this device.
          </p>
        </div>
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium text-surface-900 dark:text-white">Browser notifications</p>
            <p className="text-sm text-surface-500 dark:text-slate-400 mt-0.5">
              Task assignments, deadlines and room alerts.
            </p>
            <p className="text-xs mt-1 text-surface-400 dark:text-slate-500 capitalize">
              Status: {permission === 'unsupported' ? 'not supported in this browser' : permission}
            </p>
          </div>
          <button
            type="button"
            onClick={enableNotifications}
            disabled={permission === 'granted' || permission === 'denied' || permission === 'unsupported'}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-purple-200 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 shadow-xs transition-all shrink-0"
          >
            {permission === 'granted' ? <Check className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
            <span>{permission === 'granted' ? 'Enabled' : 'Enable notifications'}</span>
          </button>
        </div>
      </section>

      {/* Account Card */}
      <section className="rounded-2xl border border-surface-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs overflow-hidden">
        <div className="p-5 border-b border-surface-200/60 dark:border-slate-800/80">
          <h2 className="font-semibold text-base text-surface-900 dark:text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Account</span>
          </h2>
          <p className="text-sm text-surface-500 dark:text-slate-400 mt-0.5">
            Your email is private and never shown in the sidebar or to teammates.
          </p>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-1">
            <span className="text-sm text-surface-500 dark:text-slate-400">Email</span>
            <span className="text-sm font-medium text-surface-900 dark:text-white break-all">
              {profile.email}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-1 border-t border-surface-100 dark:border-slate-800/50">
            <span className="text-sm text-surface-500 dark:text-slate-400">Last sign-in</span>
            <span className="text-sm font-medium text-surface-900 dark:text-white">
              {profile.lastSignInAt ? formatDate(profile.lastSignInAt) : 'Jan 1, 2026'}
            </span>
          </div>
        </div>
      </section>

      {/* Data & Session Card */}
      <section className="rounded-2xl border border-surface-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs overflow-hidden">
        <div className="p-5 border-b border-surface-200/60 dark:border-slate-800/80">
          <h2 className="font-semibold text-base text-surface-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Data & session</span>
          </h2>
          <p className="text-sm text-surface-500 dark:text-slate-400 mt-0.5">
            Export your profile data or sign out of this device.
          </p>
        </div>
        <div className="p-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={downloadData}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-surface-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-surface-700 dark:text-slate-200 hover:bg-surface-50 dark:hover:bg-slate-700 shadow-xs transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download my data</span>
          </button>
          <button
            type="button"
            onClick={() => handleSignOut('local')}
            disabled={signingOut}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 shadow-xs transition-all"
          >
            {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            <span>Sign out</span>
          </button>
          <button
            type="button"
            onClick={() => handleSignOut('global')}
            disabled={signingOut}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/20 transition-all"
          >
            <span>Sign out of all devices</span>
          </button>
        </div>
      </section>
    </div>
  );
}
