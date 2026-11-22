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
  CheckCircle,
  FolderKanban,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { GlassIconTile } from '@/components/ui/glass-icons';
import type { Artifact } from '@/types/database';

interface ArtifactsOverviewClientProps {
  artifacts: (Artifact & { roomName: string })[];
  rooms: { id: string; name: string }[];
}

const TYPE_FILTERS = [
  'all',
  'document',
  'note',
  'reference',
  'image',
  'video',
  'apk',
  'presentation',
  'lottie',
  'riv',
  'other',
] as const;

const TYPE_ICONS: Record<string, typeof FileImage> = {
  document: FileText,
  note: FileText,
  reference: FileText,
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
            Builds, designs and deliverables from every room.
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
                            <div key={artifact.id} className="card p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-surface-900 truncate">{artifact.name}</p>
                    <p className="text-xs text-surface-500 truncate">
                      {artifact.roomName} · {formatDate(artifact.created_at)}
                    </p>
                    {artifact.is_final && (
                      <span className="badge bg-green-100 text-green-800">Final</span>
                    )}
                    {(artifact.extracted_text || artifact.content) && (
                      <span className="badge bg-indigo-100 text-indigo-800">AI Ready</span>
                    )}
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2 border-t border-surface-100">
                  <Link
                    href={`/dashboard/rooms/${artifact.room_id}/artifacts/${artifact.id}`}
                    className="btn-outline text-sm flex-1"
                  >
                    <FileText className="w-4 h-4" />
                    View
                  </Link>
                  {artifact.file_url ? (
                    <a
                      href={artifact.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost p-2"
                      aria-label={`Open ${artifact.name}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : null}
                  {artifact.file_url ? (
                    <a
                      href={artifact.file_url}
                      download
                      className="btn-ghost p-2"
                      aria-label={`Download ${artifact.name}`}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  ) : null}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    )
  }

