'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  ExternalLink,
  FileImage,
  FileText,
  FileVideo,
  Package,
  Plus,
  Search,
  Sparkles,
  RotateCw,
  ShieldCheck,
  CheckCircle,
  FolderKanban,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import TiltedCard from '@/components/ui/tilted-card';
import { GlassIconTile } from '@/components/ui/glass-icons';
import type { Artifact } from '@/types/database';

interface ArtifactsOverviewClientProps {
  artifacts: (Artifact & { roomName: string })[];
  rooms: { id: string; name: string }[];
}

const TYPE_FILTERS = ['all', 'image', 'video', 'apk', 'presentation', 'lottie', 'riv', 'other'] as const;

const TYPE_ICONS: Record<string, typeof FileImage> = {
  image: FileImage,
  video: FileVideo,
  apk: Package,
  presentation: FileText,
  lottie: Sparkles,
  riv: Sparkles,
  other: FileText,
};

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArtifactsOverviewClient({ artifacts, rooms }: ArtifactsOverviewClientProps) {
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: artifacts.length };
    for (const artifact of artifacts) {
      result[artifact.type] = (result[artifact.type] || 0) + 1;
    }
    return result;
  }, [artifacts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return artifacts.filter((artifact) => {
      const matchesType = type === 'all' || artifact.type === type;
      const matchesQuery =
        !needle ||
        artifact.name.toLowerCase().includes(needle) ||
        artifact.roomName.toLowerCase().includes(needle) ||
        artifact.tags.some((tag) => tag.toLowerCase().includes(needle));
      return matchesType && matchesQuery;
    });
  }, [artifacts, type, query]);

  const finalCount = artifacts.filter((artifact) => artifact.is_final).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Artifacts</h1>
          <p className="text-surface-600 dark:text-slate-400 mt-1">
            Builds, designs and deliverables from every room • Hover to tilt in 3D, click card to flip for specs.
          </p>
        </div>
        <Link href="/dashboard/artifacts/upload" className="btn-primary">
          <Plus className="w-5 h-5" />
          Upload Artifact
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {/* Total artifacts */}
        <div className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#faf5ff] via-[#fdf4ff] to-[#f3e8ff] border-purple-100/90 hover:border-purple-200 dark:bg-gradient-to-br dark:from-[#26153c] dark:via-[#190d29] dark:to-[#0f071a] dark:border-purple-800/50 dark:hover:border-purple-600/70 dark:shadow-purple-950/20">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 bg-purple-400/20 dark:bg-purple-500/20" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600 dark:text-purple-200/70">Total artifacts</p>
              <p className="text-3xl font-bold mt-1 transition-colors text-surface-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300">
                {artifacts.length}
              </p>
            </div>
            <div className="shrink-0 -mt-1 -mr-1 transition-transform duration-300 group-hover:scale-105">
              <GlassIconTile
                icon={<FileImage className="w-5 h-5 text-white" />}
                color="purple"
                size={46}
                roundness={0.58}
                plate="tilt"
                tilt={24}
                hover="float"
              />
            </div>
          </div>
        </div>

        {/* Final versions */}
        <div className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#ecfdf5] via-[#f6fef9] to-[#d1fae5] border-emerald-100/90 hover:border-emerald-200 dark:bg-gradient-to-br dark:from-[#0b281d] dark:via-[#071d15] dark:to-[#04120d] dark:border-emerald-700/50 dark:hover:border-emerald-600/70 dark:shadow-emerald-950/20">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 bg-emerald-400/20 dark:bg-emerald-500/20" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600 dark:text-emerald-200/70">Final versions</p>
              <p className="text-3xl font-bold mt-1 transition-colors text-surface-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                {finalCount}
              </p>
            </div>
            <div className="shrink-0 -mt-1 -mr-1 transition-transform duration-300 group-hover:scale-105">
              <GlassIconTile
                icon={<CheckCircle className="w-5 h-5 text-white" />}
                color="green"
                size={46}
                roundness={0.58}
                plate="tilt"
                tilt={24}
                hover="float"
              />
            </div>
          </div>
        </div>

        {/* Rooms covered */}
        <div className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#eff6ff] via-[#f8faff] to-[#eef2ff] border-blue-100/90 hover:border-blue-200 dark:bg-gradient-to-br dark:from-[#11192e] dark:via-[#0c1424] dark:to-[#080d19] dark:border-blue-900/50 dark:hover:border-blue-700/60 dark:shadow-blue-950/20">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 bg-blue-400/20 dark:bg-blue-500/15" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600 dark:text-slate-400">Rooms covered</p>
              <p className="text-3xl font-bold mt-1 transition-colors text-surface-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                {new Set(artifacts.map((artifact) => artifact.room_id)).size}
              </p>
            </div>
            <div className="shrink-0 -mt-1 -mr-1 transition-transform duration-300 group-hover:scale-105">
              <GlassIconTile
                icon={<FolderKanban className="w-5 h-5 text-white" />}
                color="indigo"
                size={46}
                roundness={0.58}
                plate="tilt"
                tilt={24}
                hover="float"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            className="input pl-9"
            placeholder="Search artifacts, rooms or tags…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setType(filter)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border capitalize transition-colors',
                type === filter
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-slate-900/80 text-surface-600 dark:text-slate-300 border-surface-200 dark:border-slate-800 hover:bg-surface-50 dark:hover:bg-slate-800 dark:hover:text-white'
              )}
            >
              {filter}
              <span className={cn('ml-2 text-xs', type === filter ? 'text-white/80' : 'text-surface-400 dark:text-slate-500')}>
                {counts[filter] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileImage className="w-14 h-14 mx-auto text-surface-300 dark:text-slate-600" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900 dark:text-white">
            {rooms.length === 0 ? 'No rooms yet' : 'No artifacts found'}
          </h3>
          <p className="text-surface-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {rooms.length === 0
              ? 'Create a room first, then upload your builds and designs.'
              : 'Upload an artifact or try a different filter.'}
          </p>
          <Link
            href={rooms.length === 0 ? '/dashboard/rooms/new' : '/dashboard/artifacts/upload'}
            className="btn-primary mt-6"
          >
            <Plus className="w-4 h-4" />
            {rooms.length === 0 ? 'Create a room' : 'Upload artifact'}
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((artifact) => {
            const Icon = TYPE_ICONS[artifact.type] || FileText;
            return (
              <div key={artifact.id} className="w-full flex justify-center">
                <TiltedCard
                  containerWidth="100%"
                  containerHeight="275px"
                  imageWidth="100%"
                  imageHeight="100%"
                  rotateAmplitude={14}
                  scaleOnHover={1.035}
                  glare={0.4}
                  shadow={0.5}
                  radius={16}
                  flipOnClick={true}
                  showTooltip={true}
                  captionText={`Click to flip: ${artifact.name}`}
                  className="w-full transition-shadow duration-300 hover:shadow-2xl"
                  backContent={
                    /* BACK OF CARD: SPECIFICATIONS & CHECKSUM */
                    <div className="p-5 flex flex-col justify-between h-full w-full select-none text-left">
                      <div>
                        <div className="flex items-center justify-between pb-2.5 border-b border-surface-200/60 dark:border-slate-800/80">
                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-brand-600 dark:text-brand-400">
                            <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
                            <span>Deliverable Specs</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-300 font-bold border border-brand-500/20">
                            ↺ Flip Back
                          </span>
                        </div>

                        <div className="mt-3 space-y-2 text-xs font-mono">
                          <div className="flex items-center justify-between text-surface-600 dark:text-slate-300">
                            <span className="text-surface-400 dark:text-slate-500">Room</span>
                            <span className="font-semibold truncate max-w-[170px]">{artifact.roomName}</span>
                          </div>
                          <div className="flex items-center justify-between text-surface-600 dark:text-slate-300">
                            <span className="text-surface-400 dark:text-slate-500">MIME Format</span>
                            <span className="font-semibold">{artifact.mime_type || `${artifact.type.toUpperCase()}`}</span>
                          </div>
                          <div className="flex items-center justify-between text-surface-600 dark:text-slate-300">
                            <span className="text-surface-400 dark:text-slate-500">File Size</span>
                            <span className="font-semibold">{formatBytes(artifact.file_size)}</span>
                          </div>
                          <div className="flex items-center justify-between text-surface-600 dark:text-slate-300">
                            <span className="text-surface-400 dark:text-slate-500">Checksum Hash</span>
                            <span className="font-semibold text-brand-600 dark:text-brand-300">
                              #{artifact.id.slice(-8).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-surface-600 dark:text-slate-300">
                            <span className="text-surface-400 dark:text-slate-500">Status</span>
                            <span className={`font-semibold ${artifact.is_final ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {artifact.is_final ? '● Final Release' : '○ Review Draft'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-surface-200/60 dark:border-slate-800/80 flex items-center gap-2">
                        <a
                          href={artifact.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="btn-primary text-xs flex-1 py-2 inline-flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Asset</span>
                        </a>
                        <a
                          href={artifact.file_url}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="btn-outline p-2 text-xs"
                          title={`Download ${artifact.name}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  }
                >
                  {/* FRONT OF CARD */}
                  <div className="p-5 flex flex-col justify-between h-full w-full select-none text-left">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                              artifact.type === 'image'
                                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                                : artifact.type === 'video'
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                                : artifact.type === 'apk'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                : artifact.type === 'presentation'
                                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm sm:text-base text-surface-900 dark:text-white truncate">
                              {artifact.name}
                            </p>
                            <p className="text-xs text-surface-500 dark:text-slate-400 truncate">
                              {artifact.roomName} · {formatDate(artifact.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {artifact.is_final && (
                            <span className="badge bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                              Final
                            </span>
                          )}
                          <span
                            className="p-1 rounded-md text-surface-400 hover:text-brand-600 dark:hover:text-brand-300 transition-colors"
                            title="Click card to flip for specs"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>

                      {/* Badges Row */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="badge bg-surface-100 dark:bg-slate-800 text-surface-700 dark:text-slate-300 capitalize font-medium text-[11px]">
                          {artifact.type}
                        </span>
                        {artifact.version && (
                          <span className="badge bg-surface-100 dark:bg-slate-800 text-surface-700 dark:text-slate-300 font-medium text-[11px]">
                            v{artifact.version}
                          </span>
                        )}
                        <span className="badge bg-surface-100 dark:bg-slate-800 text-surface-700 dark:text-slate-300 font-medium text-[11px]">
                          {formatBytes(artifact.file_size)}
                        </span>
                      </div>

                      {/* Tags */}
                      {artifact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {artifact.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-medium text-brand-600 dark:text-purple-400 bg-brand-50/60 dark:bg-purple-950/30"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Row */}
                    <div className="pt-2 border-t border-surface-200/60 dark:border-slate-800/80 flex items-center gap-2">
                      <a
                        href={artifact.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="btn-outline text-xs flex-1 py-1.5 inline-flex items-center justify-center gap-1.5 hover:bg-brand-500/10 dark:hover:bg-brand-500/20 hover:text-brand-600 dark:hover:text-brand-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </a>
                      <a
                        href={artifact.file_url}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="btn-ghost p-2 text-surface-400 hover:text-surface-900 dark:hover:text-white"
                        aria-label={`Download ${artifact.name}`}
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </TiltedCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
