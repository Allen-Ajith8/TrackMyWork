'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, Mail, Search, UserPlus, Users } from 'lucide-react';
import { cn, getRoleColor } from '@/lib/utils';

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

function CopyCode({ code }: { code: string }) {
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

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-1 text-xs font-mono text-surface-700 hover:bg-surface-50"
      title="Copy invite code"
    >
      {code}
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Team</h1>
          <p className="text-surface-600 mt-1">
            Everyone working with you, grouped by room.
          </p>
        </div>
        <Link href="/dashboard/rooms" className="btn-outline">
          <UserPlus className="w-5 h-5" />
          Manage invites
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-surface-500">Rooms</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{rooms.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-surface-500">Seats filled</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{totalMembers}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-surface-500">Unique teammates</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{uniqueMembers}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          className="input pl-9"
          placeholder="Search teammates, roles or rooms…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {rooms.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-14 h-14 mx-auto text-surface-300" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900">No teammates yet</h3>
          <p className="text-surface-500 mt-1 max-w-md mx-auto">
            Create a room and share its invite code to bring your team in.
          </p>
          <Link href="/dashboard/rooms/new" className="btn-primary mt-6">
            <UserPlus className="w-4 h-4" />
            Create a room
          </Link>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-12 h-12 mx-auto text-surface-300" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900">No matches</h3>
          <p className="text-surface-500 mt-1">Try a different name, role or room.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredRooms.map((room) => (
            <div key={room.id} className="card overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-surface-200 bg-surface-50/60">
                <div>
                  <h2 className="font-semibold text-surface-900">{room.name}</h2>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {room.members.length} member{room.members.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-500">Invite</span>
                  <CopyCode code={room.inviteCode} />
                  <Link
                    href={`/dashboard/rooms/${room.id}/team`}
                    className="btn-outline text-sm ml-1"
                  >
                    Open
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {room.members.length === 0 ? (
                <div className="p-6 text-sm text-surface-500">
                  No members loaded for this room yet.
                </div>
              ) : (
                <div className="divide-y divide-surface-200">
                  {room.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-4">
                      <div className="w-10 h-10 rounded-full bg-primary-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {member.user?.avatarUrl ? (
                          <img
                            src={member.user.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-primary-700 font-semibold">
                            {(member.user?.displayName || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-surface-900 truncate">
                            {member.user?.displayName || 'Member'}
                          </p>
                          {member.isTeamLeader && (
                            <span className="badge bg-purple-100 text-purple-800">Team Leader</span>
                          )}
                          {member.status !== 'active' && (
                            <span className="badge bg-surface-100 text-surface-600 capitalize">
                              {member.status}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-surface-500 truncate">
                          {member.user?.username ? `@${member.user.username}` : 'No username'}
                        </p>
                      </div>
                      <span className={cn('badge hidden sm:inline-flex', getRoleColor(member.role))}>
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rooms.length > 0 && (
        <div className="card p-5 flex items-start gap-3">
          <Mail className="w-5 h-5 text-primary-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-surface-900">Inviting people</h3>
            <p className="text-sm text-surface-600 mt-1">
              Open a room&apos;s Team tab to invite members by email, assign roles, and manage
              permissions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
