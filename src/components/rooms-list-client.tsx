'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  FolderKanban,
  Users,
  Lock,
  ArrowRight,
  Zap,
  Key,
  Check,
  Copy,
  Ticket,
  LayoutGrid,
  ExternalLink,
  Sparkles,
  Terminal,
  GitBranch,
  Rocket,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';
import TearTicket from '@/components/ui/tear-ticket';
import type { Room } from '@/types/database';

interface RoomWithRole extends Room {
  user_role: string;
  is_team_leader: boolean;
}

function getRoomEngineeringData(room: RoomWithRole) {
  const nameDesc = (room.name + ' ' + (room.description || '')).toLowerCase();

  if (nameDesc.includes('fintech')) {
    return {
      psCode: 'PS-FT04',
      psText:
        room.problem_statement ||
        room.description ||
        'Real-time multi-agent fraud anomaly detection & streaming financial risk engine.',
      techStack: ['Python', 'FastAPI', 'Next.js', 'PyTorch'],
      gitBranch: 'feat/anomaly-core',
      gitCommit: '#8f20b41',
      trackName: 'AI & FINTECH TRACK',
      sprintBadge: 'SPRINT S-01',
    };
  }

  if (nameDesc.includes('drone') || nameDesc.includes('robotics')) {
    return {
      psCode: 'PS-ROB11',
      psText:
        room.problem_statement ||
        room.description ||
        'Autonomous UAV swarm mesh telemetry & relay sync in GPS-denied environments.',
      techStack: ['ROS 2', 'C++', 'ESP32', 'LoRaWAN'],
      gitBranch: 'telemetry/mesh-sync',
      gitCommit: '#31a0e19',
      trackName: 'ROBOTICS & HARDWARE',
      sprintBadge: 'SPRINT S-02',
    };
  }

  if (nameDesc.includes('hardware') || room.project_type === 'hardware') {
    return {
      psCode: 'PS-HW07',
      psText:
        room.problem_statement ||
        room.description ||
        'Low-power edge sensor mesh telemetry with automated BOM component procurement.',
      techStack: ['Embedded C', 'KiCad', 'FreeRTOS', 'MQTT'],
      gitBranch: 'firmware/v1.4',
      gitCommit: '#d41c98e',
      trackName: 'HARDWARE & IOT',
      sprintBadge: 'SPRINT S-01',
    };
  }

  return {
    psCode: `PS-${room.id.slice(-4).toUpperCase()}`,
    psText:
      room.problem_statement ||
      room.description ||
      'Autonomous collaborative engineering sprint & team workspace challenge.',
    techStack:
      room.project_type === 'software'
        ? ['TypeScript', 'Next.js', 'Node.js', 'AI Agent']
        : ['Embedded C', 'ESP32', 'Sensors'],
    gitBranch: 'main',
    gitCommit: `#${room.id.slice(-7)}`,
    trackName: `${room.project_type.toUpperCase()} TRACK`,
    sprintBadge: 'SPRINT S-01',
  };
}

interface RoomsListClientProps {
  user: {
    id: string;
    email?: string;
    username?: string | null;
    display_name?: string | null;
    is_global_admin?: boolean;
  };
  rooms: RoomWithRole[];
}

export function RoomsListClient({ user, rooms }: RoomsListClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'ticket' | 'grid'>('ticket');
  const [tornRooms, setTornRooms] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = async (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {}
  };

  const handleTearRoom = (roomId: string) => {
    setTornRooms((prev) => ({ ...prev, [roomId]: true }));
    setTimeout(() => {
      router.push(`/dashboard/rooms/${roomId}`);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Your Rooms</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              {rooms.length} Active {rooms.length === 1 ? 'Room' : 'Rooms'}
            </span>
          </div>
          <p className="text-surface-600 dark:text-slate-400 text-sm">
            Manage your hackathon projects, problem statements, and teams • Tear credentials stub to launch workspace
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Switcher Toggle */}
          <div className="flex items-center rounded-xl bg-surface-100 dark:bg-slate-900 border border-surface-200 dark:border-slate-800 p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('ticket')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'ticket'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-surface-500 hover:text-surface-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Sprint Passes</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-surface-500 hover:text-surface-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          <Link href="/dashboard/rooms/join">
            <Button variant="outline" className="shadow-xs">
              <Key className="w-4 h-4 mr-2 text-brand-600" />
              Join with Code
            </Button>
          </Link>
          <Link href="/dashboard/rooms/new">
            <Button className="shadow-xs">
              <Plus className="w-4 h-4 mr-2" />
              Create Room
            </Button>
          </Link>
        </div>
      </div>

      {rooms.length === 0 ? (
        /* Empty State */
        <Card className="text-center py-12">
          <CardContent className="pt-6">
            <FolderKanban className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No rooms yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first hackathon room or join an existing team room using an invitation link or 6-digit code.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/dashboard/rooms/join">
                <Button variant="outline" size="lg">
                  <Key className="w-4 h-4 mr-2" />
                  Join with Code
                </Button>
              </Link>
              <Link href="/dashboard/rooms/new">
                <Button size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Room
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'ticket' ? (
        /* ========================================================================= */
        /* TEAR TICKET INTERACTIVE PASSES VIEW                                       */
        /* ========================================================================= */
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const isFintech = (room.name + (room.description || '')).toLowerCase().includes('fintech');
            const isDrone = (room.name + (room.description || '')).toLowerCase().includes('drone') || (room.name + (room.description || '')).toLowerCase().includes('robotics');
            const isHardware = (room.name + (room.description || '')).toLowerCase().includes('hardware') || (room.project_type || '').includes('hardware');
            const eng = getRoomEngineeringData(room);

            return (
              <div key={room.id} className="flex justify-center w-full">
                <TearTicket
                  width={480}
                  height={270}
                  stubSize={145}
                  radius={16}
                  holes={11}
                  holeSize={7}
                  notch={4}
                  roughness={0.5}
                  tearAngle={28}
                  stretch={28}
                  resistance={0.4}
                  tilt={true}
                  tiltMax={8}
                  tiltReach={260}
                  background="var(--ticket-paper-bg)"
                  stubBackground="var(--ticket-stub-bg)"
                  color="var(--ticket-paper-ink)"
                  borderColor="var(--ticket-paper-edge)"
                  borderWidth={1}
                  torn={tornRooms[room.id] || false}
                  onTear={() => handleTearRoom(room.id)}
                  ariaLabel={`Tear sprint pass to launch ${room.name}`}
                  className="transition-shadow duration-300 hover:shadow-2xl"
                  stub={
                    /* ======================================================= */
                    /* TICKET STUB (DEVELOPER SPRINT PASS CREDENTIAL)          */
                    /* ======================================================= */
                    <div className="p-3 flex flex-col justify-between items-center text-center h-full w-full select-none">
                      {/* Top Stub Header: Dev Credential Badge */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
                          <span className="text-[9px] font-mono tracking-wider font-extrabold uppercase text-surface-600 dark:text-slate-300">
                            DEV PASS
                          </span>
                        </div>
                        <span className="text-[8px] font-mono font-bold text-surface-400 dark:text-slate-500 uppercase tracking-widest block">
                          {eng.sprintBadge}
                        </span>
                      </div>

                      {/* Center: Invite Code + Git Telemetry (Replaces Cinema Barcode) */}
                      <div className="w-full my-auto space-y-2 px-0.5">
                        {/* Invite Key Box */}
                        <div className="p-2 rounded-xl bg-surface-100/90 dark:bg-slate-800/90 border border-surface-200 dark:border-slate-700/80 shadow-xs">
                          <div className="flex items-center justify-center gap-1 text-[8.5px] font-mono font-bold text-surface-500 dark:text-slate-400 uppercase">
                            <Lock className="w-2.5 h-2.5 text-brand-500" />
                            <span>Invite Key</span>
                          </div>
                          <div className="flex items-center justify-center gap-1 pt-0.5">
                            <span className="text-xs font-mono font-black text-brand-600 dark:text-brand-300 tracking-wider">
                              {room.invite_code}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyCode(room.invite_code, e)}
                              className="p-1 rounded text-surface-400 hover:text-brand-600 dark:hover:text-brand-300 transition-colors"
                              title="Copy Invite Code"
                            >
                              {copiedCode === room.invite_code ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Developer Git Telemetry Micro-Card */}
                        <div className="p-1.5 rounded-lg bg-surface-100/70 dark:bg-slate-900/80 border border-surface-200/80 dark:border-slate-800/90 text-left font-mono text-[8px]">
                          <div className="flex items-center justify-between text-surface-500 dark:text-slate-400 pb-1 border-b border-surface-200/50 dark:border-slate-800">
                            <span className="flex items-center gap-1 truncate max-w-[70px] text-brand-600 dark:text-brand-300 font-bold">
                              <GitBranch className="w-2.5 h-2.5 shrink-0" />
                              {eng.gitBranch}
                            </span>
                            <span className="text-emerald-500 font-bold text-[7.5px] shrink-0">● LIVE</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 text-surface-500 dark:text-slate-400">
                            <span className="text-[7.5px] uppercase">Commit</span>
                            <span className="font-bold text-surface-800 dark:text-slate-200 text-[7.5px]">{eng.gitCommit}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Tear Launch CTA */}
                      <div className="w-full pt-1">
                        <div className="px-2 py-1.5 rounded-lg bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 font-bold text-[10px] flex items-center justify-center gap-1.5 border border-brand-500/25 shadow-xs transition-colors hover:bg-brand-500/20">
                          <Rocket className="w-3 h-3 shrink-0 text-brand-500" />
                          <span>Tear to Launch</span>
                        </div>
                      </div>
                    </div>
                  }
                >
                  {/* Main Ticket Body Content */}
                  <div
                    onClick={() => router.push(`/dashboard/rooms/${room.id}`)}
                    className="p-3.5 sm:p-4 flex flex-col justify-between h-full space-y-2 cursor-pointer"
                  >
                    {/* Top Row: Icon + Hackathon/Project Badge + Role Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 ${
                            isFintech
                              ? 'bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500'
                              : isDrone
                              ? 'bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600'
                              : isHardware
                              ? 'bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600'
                              : 'bg-gradient-to-br from-brand-600 to-purple-600'
                          }`}
                        >
                          {isHardware ? (
                            <Cpu className="w-5 h-5" />
                          ) : isDrone ? (
                            <Rocket className="w-5 h-5" />
                          ) : (
                            <FolderKanban className="w-5 h-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9.5px] font-mono font-bold tracking-wider uppercase text-brand-600 dark:text-brand-400">
                              {(room as any).hackathon_name || 'GLOBAL HACKATHON 2026'}
                            </span>
                            <span className="text-surface-300 dark:text-slate-600">•</span>
                            <span className="text-[9px] font-medium text-surface-500 dark:text-slate-400 uppercase">
                              {eng.trackName}
                            </span>
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-surface-900 dark:text-white truncate">
                            {room.name}
                          </h3>
                        </div>
                      </div>

                      <Badge variant="role" role={room.user_role} className="shrink-0 text-[10px]">
                        {room.user_role}
                      </Badge>
                    </div>

                    {/* Middle Problem Statement (PS) Block */}
                    <div className="p-2 sm:p-2.5 rounded-xl bg-surface-100/80 dark:bg-slate-800/60 border border-surface-200/80 dark:border-slate-700/60 text-left">
                      <div className="flex items-center justify-between gap-1 text-[8.5px] font-mono font-bold uppercase mb-0.5">
                        <span className="flex items-center gap-1 text-brand-600 dark:text-brand-400">
                          <Terminal className="w-2.5 h-2.5 text-brand-500" />
                          <span>Problem Statement</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 font-bold text-[8px] border border-brand-500/20">
                          {eng.psCode}
                        </span>
                      </div>
                      <p className="text-[11.5px] font-medium text-surface-800 dark:text-slate-200 line-clamp-2 leading-snug">
                        {eng.psText}
                      </p>
                    </div>

                    {/* Tech Stack Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {eng.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-0.5 rounded-md text-[9.5px] font-mono font-medium bg-surface-200/70 dark:bg-slate-800/90 text-surface-700 dark:text-slate-300 border border-surface-300/40 dark:border-slate-700/60"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    {/* Sprint Metrics: Members, Repo Link, Status */}
                    <div className="flex items-center gap-3 text-[11px] text-surface-500 dark:text-slate-400 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                        <span>{room.team_size} Devs</span>
                      </div>
                      {room.github_repo && (
                        <a
                          href={room.github_repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:underline"
                        >
                          <Zap className="w-3 h-3 text-brand-500 shrink-0" />
                          <span>Repo</span>
                        </a>
                      )}
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Sparkles className="w-3 h-3" />
                        <span>Active Sprint</span>
                      </div>
                    </div>

                    {/* Bottom Row: Timestamp + Launch Action */}
                    <div className="pt-1.5 border-t border-surface-200/80 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-surface-400 dark:text-slate-500">
                        Created {formatRelativeTime(room.created_at)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-brand-600 dark:text-brand-400 hover:underline">
                        <span>Launch Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </TearTicket>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================================= */
        /* CLASSIC CARDS GRID VIEW                                                  */
        /* ========================================================================= */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Link key={room.id} href={`/dashboard/rooms/${room.id}`} className="block">
              <Card className="card-hover h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                        <FolderKanban className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{room.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {(room as any).hackathon_name ? `${(room as any).hackathon_name} • ` : ''}
                          {room.project_type} • {room.team_size} members
                        </p>
                      </div>
                    </div>
                    <Badge variant="role" role={room.user_role}>{room.user_role}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="w-4 h-4" />
                      <span>Invite: {room.invite_code}</span>
                    </div>
                    {room.description && (
                      <p className="text-muted-foreground line-clamp-2">{room.description}</p>
                    )}
                    {room.github_repo && (
                      <a href={room.github_repo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline text-sm">
                        <Zap className="w-3 h-3" />
                        GitHub Repo
                      </a>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>Created</span>
                      <span>{formatRelativeTime(room.created_at)}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {room.is_team_leader ? 'Team Leader' : 'Member'}
                    </span>
                    <Button variant="ghost" size="sm" className="h-8 px-3">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
