'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Copy,
  Mail,
  Search,
  Plus,
  Users,
  FolderKanban,
  ClipboardCheck,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TeamMemberView {
  id: string;
  userId: string;
  role: string;
  status: string;
  isTeamLeader: boolean;
  user: {
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface TeamRoom {
  id: string;
  name: string;
  inviteCode: string;
  members: TeamMemberView[];
}

interface TeamOverviewClientProps {
  rooms: TeamRoom[];
}

function CopyCode({
  code,
  theme = 'purple',
}: {
  code: string;
  theme?: 'purple' | 'amber' | 'teal' | 'blue';
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const borderClass =
    theme === 'amber'
      ? 'border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40'
      : theme === 'teal'
      ? 'border-teal-200 dark:border-teal-800/80 text-teal-900 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/40'
      : theme === 'blue'
      ? 'border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/40'
      : 'border-purple-200 dark:border-purple-800/80 text-purple-900 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/40';

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border bg-white/90 dark:bg-slate-900/80 px-2.5 py-1 text-xs font-mono font-medium shadow-2xs transition-colors',
        borderClass
      )}
      title="Copy invite code"
    >
      {code}
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-600 dark:text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5 opacity-70" />
      )}
    </button>
  );
}

const ROOM_THEMES = [
  {
    cardClass:
      'border-purple-300/80 dark:border-purple-800/70 bg-gradient-to-r from-purple-50/40 via-white to-pink-50/20 dark:from-[#1b1528] dark:via-[#131929] dark:to-[#171226]',
    dividerClass: 'border-purple-100/80 dark:border-purple-950/60',
    buttonClass:
      'bg-purple-950 hover:bg-purple-900 text-white dark:bg-purple-600 dark:hover:bg-purple-500 shadow-purple-950/20',
    badgeClass:
      'bg-purple-100/90 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60',
    roleTextClass: 'text-purple-700 dark:text-purple-300',
    themeName: 'purple' as const,
  },
  {
    cardClass:
      'border-amber-300/80 dark:border-amber-800/70 bg-gradient-to-r from-amber-50/40 via-white to-orange-50/20 dark:from-[#251b0f] dark:via-[#181310] dark:to-[#1a1208]',
    dividerClass: 'border-amber-100/80 dark:border-amber-950/60',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-950/20',
    badgeClass:
      'bg-amber-100/90 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60',
    roleTextClass: 'text-amber-700 dark:text-amber-300',
    themeName: 'amber' as const,
  },
  {
    cardClass:
      'border-teal-300/80 dark:border-teal-800/70 bg-gradient-to-r from-teal-50/40 via-white to-emerald-50/20 dark:from-[#0d2320] dark:via-[#131929] dark:to-[#0a1b18]',
    dividerClass: 'border-teal-100/80 dark:border-teal-950/60',
    buttonClass: 'bg-teal-700 hover:bg-teal-800 text-white shadow-teal-950/20',
    badgeClass:
      'bg-teal-100/90 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60',
    roleTextClass: 'text-teal-700 dark:text-teal-300',
    themeName: 'teal' as const,
  },
  {
    cardClass:
      'border-blue-300/80 dark:border-blue-800/70 bg-gradient-to-r from-blue-50/40 via-white to-indigo-50/20 dark:from-[#11192e] dark:via-[#131929] dark:to-[#0c1424]',
    dividerClass: 'border-blue-100/80 dark:border-blue-950/60',
    buttonClass: 'bg-blue-700 hover:bg-blue-800 text-white shadow-blue-950/20',
    badgeClass:
      'bg-blue-100/90 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60',
    roleTextClass: 'text-blue-700 dark:text-blue-300',
    themeName: 'blue' as const,
  },
];

export function TeamOverviewClient({ rooms }: TeamOverviewClientProps) {
  const [query, setQuery] = useState('');

  const totalMembers = rooms.reduce((sum, room) => sum + room.members.length, 0);
  const uniqueMembers = new Set(
    rooms.flatMap((room) => room.members.map((member) => member.userId))
  ).size;

  const filteredRooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rooms;

    return rooms
      .map((room) => ({
        ...room,
        members: room.members.filter((member) => {
          const name = member.user?.displayName?.toLowerCase() || '';
          const username = member.user?.username?.toLowerCase() || '';
          return (
            name.includes(needle) ||
            username.includes(needle) ||
            room.name.toLowerCase().includes(needle) ||
            member.role.toLowerCase().includes(needle)
          );
        }),
      }))
      .filter((room) => room.members.length > 0 || room.name.toLowerCase().includes(needle));
  }, [rooms, query]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Team</h1>
          <p className="text-surface-600 dark:text-slate-400 mt-1">
            Everyone working with you, grouped by room.
          </p>
        </div>
        <Link
          href="/dashboard/rooms"
          className="inline-flex items-center gap-2 rounded-xl border border-purple-400/80 dark:border-purple-600/80 bg-white/90 dark:bg-purple-950/25 px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/40 shadow-2xs transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          <span>Manage invites</span>
        </Link>
      </div>

      {/* Top Stat Cards matching user reference */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Rooms Card */}
        <div className="relative overflow-hidden rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-r from-[#93c5fd] via-[#a5b4fc] to-[#818cf8] dark:from-[#1b2b4c] dark:via-[#15213b] dark:to-[#0f1629] dark:border dark:border-blue-500/30">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-blue-200">Rooms</p>
              <p className="text-3xl font-bold mt-1 text-slate-950 dark:text-white">{rooms.length}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/35 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center shrink-0">
              <FolderKanban className="w-7 h-7 text-indigo-800/80 dark:text-blue-200" />
            </div>
          </div>
        </div>

        {/* Seats filled Card */}
        <div className="relative overflow-hidden rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-r from-[#fde68a] via-[#fbbf24] to-[#fb923c] dark:from-[#352511] dark:via-[#261909] dark:to-[#170e04] dark:border dark:border-amber-500/30">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-950 dark:text-amber-200">Seats filled</p>
              <p className="text-3xl font-bold mt-1 text-amber-950 dark:text-white">{totalMembers}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/35 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-7 h-7 text-amber-900/80 dark:text-amber-200" />
            </div>
          </div>
        </div>

        {/* Unique teammates Card */}
        <div className="relative overflow-hidden rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-r from-[#6ee7b7] via-[#34d399] to-[#2dd4bf] dark:from-[#0d2a22] dark:via-[#091f19] dark:to-[#051410] dark:border dark:border-emerald-500/30">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-950 dark:text-emerald-200">Unique teammates</p>
              <p className="text-3xl font-bold mt-1 text-emerald-950 dark:text-white">{uniqueMembers}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/35 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-teal-900/80 dark:text-teal-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 dark:text-slate-400" />
        <input
          className="w-full rounded-2xl border border-purple-200/80 dark:border-purple-900/50 bg-white/95 dark:bg-[#111625]/90 py-3 pl-11 pr-4 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-slate-500 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:border-purple-400 transition-all"
          placeholder="Search teammates, roles or rooms..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-2xl border border-surface-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-12 text-center">
          <Users className="w-14 h-14 mx-auto text-surface-300 dark:text-slate-600" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900 dark:text-white">No teammates yet</h3>
          <p className="text-surface-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Create a room and share its invite code to bring your team in.
          </p>
          <Link href="/dashboard/rooms/new" className="btn-primary mt-6">
            <Plus className="w-4 h-4" />
            Create a room
          </Link>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="rounded-2xl border border-surface-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-12 text-center">
          <Search className="w-12 h-12 mx-auto text-surface-300 dark:text-slate-600" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900 dark:text-white">No matches</h3>
          <p className="text-surface-500 dark:text-slate-400 mt-1">Try a different name, role or room.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRooms.map((room, roomIdx) => {
            const theme = ROOM_THEMES[roomIdx % ROOM_THEMES.length];
            return (
              <div
                key={room.id}
                className={cn(
                  'rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:shadow-md',
                  theme.cardClass
                )}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-surface-900 dark:text-white">
                      {room.name}
                    </h2>
                    <p className="text-xs text-surface-500 dark:text-slate-400 mt-0.5">
                      {room.members.length} member{room.members.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-surface-500 dark:text-slate-400 font-medium">
                      Invite
                    </span>
                    <CopyCode code={room.inviteCode} theme={theme.themeName} />
                    <Link
                      href={`/dashboard/rooms/${room.id}/team`}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium shadow-sm transition-all',
                        theme.buttonClass
                      )}
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Body: Members or Empty state */}
                {room.members.length === 0 ? (
                  <div className="mt-4 rounded-xl bg-surface-100/70 dark:bg-slate-800/40 border border-surface-200/50 dark:border-slate-800/60 px-4 py-3 text-sm text-surface-500 dark:text-slate-400">
                    No members loaded for this room yet.
                  </div>
                ) : (
                  <div className={cn('mt-4 pt-4 border-t divide-y', theme.dividerClass)}>
                    {room.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          {/* Member avatar with purple gradient */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold flex items-center justify-center shrink-0 shadow-xs text-sm overflow-hidden">
                            {member.user?.avatarUrl ? (
                              <img
                                src={member.user.avatarUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              (member.user?.displayName || 'D').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-surface-900 dark:text-white text-sm">
                                {member.user?.displayName || 'Developer'}
                              </p>
                              {member.isTeamLeader && (
                                <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', theme.badgeClass)}>
                                  Team Leader
                                </span>
                              )}
                              {member.status !== 'active' && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 dark:bg-slate-800 text-surface-600 dark:text-slate-300 capitalize">
                                  {member.status}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-surface-500 dark:text-slate-400 mt-0.5">
                              {member.user?.username ? `@${member.user.username}` : '@developer'}
                            </p>
                          </div>
                        </div>

                        {/* Right side role */}
                        <div className={cn('text-xs font-medium', theme.roleTextClass)}>
                          {member.isTeamLeader ? 'Team Leader' : member.role}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Tip Card: Inviting people */}
      {rooms.length > 0 && (
        <div className="rounded-2xl border border-purple-300/80 dark:border-purple-800/70 bg-white/95 dark:bg-[#121626]/90 p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-white text-sm">Inviting people</h3>
            <p className="text-xs text-surface-600 dark:text-slate-400 mt-0.5">
              Open a room&apos;s Team tab to invite members by email, assign roles, and manage
              permissions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
