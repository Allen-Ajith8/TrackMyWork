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
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
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
          <h1 className="text-2xl font-bold text-surface-900">Artifacts</h1>
          <p className="text-surface-600 mt-1">
            Builds, designs and deliverables from every room.
          </p>
        </div>
        <Link href="/dashboard/artifacts/upload" className="btn-primary">
          <Plus className="w-5 h-5" />
          Upload Artifact
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-surface-500">Total artifacts</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{artifacts.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-surface-500">Final versions</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{finalCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-surface-500">Rooms covered</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">
            {new Set(artifacts.map((artifact) => artifact.room_id)).size}
          </p>
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
                  : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
              )}
            >
              {filter}
              <span className={cn('ml-2 text-xs', type === filter ? 'text-white/80' : 'text-surface-400')}>
                {counts[filter] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileImage className="w-14 h-14 mx-auto text-surface-300" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900">
            {rooms.length === 0 ? 'No rooms yet' : 'No artifacts found'}
          </h3>
          <p className="text-surface-500 mt-1 max-w-md mx-auto">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  </div>
                  {artifact.is_final && (
                    <span className="badge bg-green-100 text-green-800">Final</span>
                  )}
                  {(artifact.extracted_text || artifact.content) && (
                    <span className="badge bg-indigo-100 text-indigo-800">AI Ready</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="badge bg-surface-100 text-surface-700 capitalize">{artifact.type}</span>
                  {artifact.version && (
                    <span className="badge bg-surface-100 text-surface-700">v{artifact.version}</span>
                  )}
                  <span className="badge bg-surface-100 text-surface-700">{formatBytes(artifact.file_size)}</span>
                </div>

                {artifact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {artifact.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-xs text-primary-600">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

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
            );
          })}
        </div>
      )}
    </div>
  );
}
