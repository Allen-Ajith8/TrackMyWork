'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Clock, FileImage, Package, ClipboardList } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

export interface ActivityEntry {
  id: string;
  type: 'task' | 'bom' | 'artifact';
  title: string;
  detail: string;
  roomName: string;
  createdAt: string;
  href: string;
}

const FILTERS = [
  { id: 'all', label: 'All activity' },
  { id: 'task', label: 'Tasks' },
  { id: 'bom', label: 'BOM' },
  { id: 'artifact', label: 'Artifacts' },
] as const;

const TYPE_META = {
  task: { icon: ClipboardList, className: 'bg-blue-50 text-blue-600', label: 'Task' },
  bom: { icon: Package, className: 'bg-purple-50 text-purple-600', label: 'BOM' },
  artifact: { icon: FileImage, className: 'bg-pink-50 text-pink-600', label: 'Artifact' },
};

export function ActivityFeedClient({
  entries,
  hasRooms,
}: {
  entries: ActivityEntry[];
  hasRooms: boolean;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: entries.length, task: 0, bom: 0, artifact: 0 };
    for (const entry of entries) result[entry.type] += 1;
    return result;
  }, [entries]);

  const filtered = useMemo(
    () => entries.filter((entry) => filter === 'all' || entry.type === filter),
    [entries, filter]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Recent activity</h1>
        <p className="text-surface-600 mt-1">
          Everything that happened across your rooms, newest first.
        </p>
      </div>

      <div className="card p-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              filter === item.id
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
            )}
          >
            {item.label}
            <span className={cn('ml-2 text-xs', filter === item.id ? 'text-white/80' : 'text-surface-400')}>
              {counts[item.id] || 0}
            </span>
          </button>
        ))}
      </div>

      {!hasRooms ? (
        <div className="card p-12 text-center">
          <Activity className="w-14 h-14 mx-auto text-surface-300" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900">No activity yet</h3>
          <p className="text-surface-500 mt-1 max-w-md mx-auto">
            Create your first room to start tracking tasks, BOM items and artifacts.
          </p>
          <Link href="/dashboard/rooms/new" className="btn-primary mt-6">
            Create a room
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Activity className="w-12 h-12 mx-auto text-surface-300" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900">Nothing here yet</h3>
          <p className="text-surface-500 mt-1">Try a different filter.</p>
        </div>
      ) : (
        <div className="card p-2">
          <ol className="relative">
            {filtered.map((entry, index) => {
              const meta = TYPE_META[entry.type];
              const Icon = meta.icon;
              return (
                <li key={entry.id} className="relative flex gap-4 p-4">
                  {index < filtered.length - 1 && (
                    <span className="absolute left-[35px] top-14 bottom-0 w-px bg-surface-200" />
                  )}
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                      meta.className
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <Link
                    href={entry.href}
                    className="flex-1 min-w-0 rounded-lg p-2 -m-2 hover:bg-surface-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-surface-900 truncate">{entry.title}</p>
                        <p className="text-sm text-surface-500 truncate">
                          {meta.label} · {entry.detail} · {entry.roomName}
                        </p>
                      </div>
                      <span className="text-xs text-surface-400 flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </div>
                  </Link>
                  <ArrowRight className="w-4 h-4 text-surface-300 self-center hidden sm:block" />
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
