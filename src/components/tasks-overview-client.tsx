'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle,
  ClipboardList,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { GlassIconTile } from '@/components/ui/glass-icons';
import { cn, formatRelativeTime, getTaskStatusColor } from '@/lib/utils';
import { usePanicTasks } from '@/hooks/usePanicTasks';
import type { Task, TaskStatus } from '@/types/database';

interface TasksOverviewClientProps {
  tasks: (Task & { roomName: string })[];
  rooms: { id: string; name: string }[];
  initialStatus?: string;
}

const STATUS_FILTERS: { id: 'all' | TaskStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
  { id: 'blocked', label: 'Blocked' },
];

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Low',
  1: 'Low',
  2: 'Low',
  3: 'Medium',
  4: 'Medium',
  5: 'Medium',
  6: 'High',
  7: 'High',
  8: 'Critical',
  9: 'Critical',
  10: 'Critical',
};

export function TasksOverviewClient({
  tasks,
  rooms,
  initialStatus = 'all',
}: TasksOverviewClientProps) {
  const [status, setStatus] = useState<'all' | TaskStatus>(
    STATUS_FILTERS.some((filter) => filter.id === initialStatus)
      ? (initialStatus as 'all' | TaskStatus)
      : 'all'
  );
  const [query, setQuery] = useState('');
  const { isPanicMode, panicTasks } = usePanicTasks({ tasks });
  const baseTasks = isPanicMode ? panicTasks : tasks;

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: baseTasks.length };
    for (const task of baseTasks) {
      result[task.status] = (result[task.status] || 0) + 1;
    }
    return result;
  }, [baseTasks]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return baseTasks.filter((task) => {
      const matchesStatus = status === 'all' || task.status === status;
      const matchesQuery =
        !needle ||
        task.title.toLowerCase().includes(needle) ||
        task.roomName.toLowerCase().includes(needle) ||
        task.category.toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [baseTasks, status, query]);

  const activeCount = tasks.filter((task) => task.status !== 'done').length;
  const overdueCount = tasks.filter(
    (task) =>
      task.due_date &&
      task.status !== 'done' &&
      new Date(task.due_date).getTime() < Date.now()
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Tasks</h1>
          <p className="text-surface-600 dark:text-slate-400 mt-1">
            Every task across your rooms, in one place.
          </p>
        </div>
        <Link href="/dashboard/tasks/new" className="btn-primary">
          <Plus className="w-5 h-5" />
          New Task
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {/* Open tasks */}
        <div
          onClick={() => setStatus('in_progress')}
          className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#eff6ff] via-[#f8faff] to-[#eef2ff] border-blue-100/90 hover:border-blue-200 dark:bg-gradient-to-br dark:from-[#11192e] dark:via-[#0c1424] dark:to-[#080d19] dark:border-blue-900/50 dark:hover:border-blue-700/60 dark:shadow-blue-950/20"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 bg-blue-400/20 dark:bg-blue-500/15" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600 dark:text-slate-400">Open tasks</p>
              <p className="text-3xl font-bold mt-1 transition-colors text-surface-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300">
                {activeCount}
              </p>
            </div>
            <div className="shrink-0 -mt-1 -mr-1 transition-transform duration-300 group-hover:scale-105">
              <GlassIconTile
                icon={<ClipboardList className="w-5 h-5 text-white" />}
                color="blue"
                size={46}
                roundness={0.58}
                plate="tilt"
                tilt={24}
                hover="float"
              />
            </div>
          </div>
        </div>

        {/* Completed */}
        <div
          onClick={() => setStatus('done')}
          className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#ecfdf5] via-[#f6fef9] to-[#d1fae5] border-emerald-100/90 hover:border-emerald-200 dark:bg-gradient-to-br dark:from-[#0b281d] dark:via-[#071d15] dark:to-[#04120d] dark:border-emerald-700/50 dark:hover:border-emerald-600/70 dark:shadow-emerald-950/20"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 bg-emerald-400/20 dark:bg-emerald-500/20" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600 dark:text-emerald-200/70">Completed</p>
              <p className="text-3xl font-bold mt-1 transition-colors text-surface-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                {counts.done || 0}
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

        {/* Overdue */}
        <div
          className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#fff1f2] via-[#fff5f5] to-[#ffe4e6] border-rose-100/90 hover:border-rose-200 dark:bg-gradient-to-br dark:from-[#2e0d13] dark:via-[#20090e] dark:to-[#130508] dark:border-rose-800/50 dark:hover:border-rose-600/70 dark:shadow-rose-950/20"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 bg-rose-400/20 dark:bg-rose-500/20" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600 dark:text-rose-200/70">Overdue</p>
              <p className="text-3xl font-bold mt-1 transition-colors text-surface-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-300">
                {overdueCount}
              </p>
            </div>
            <div className="shrink-0 -mt-1 -mr-1 transition-transform duration-300 group-hover:scale-105">
              <GlassIconTile
                icon={<SlidersHorizontal className="w-5 h-5 text-white" />}
                color="red"
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
            placeholder="Search by task, room or category…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatus(filter.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                status === filter.id
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-slate-900/80 text-surface-600 dark:text-slate-300 border-surface-200 dark:border-slate-800 hover:bg-surface-50 dark:hover:bg-slate-800 dark:hover:text-white'
              )}
            >
              {filter.label}
              <span
                className={cn(
                  'ml-2 text-xs',
                  status === filter.id ? 'text-white/80' : 'text-surface-400 dark:text-slate-500'
                )}
              >
                {counts[filter.id] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          {isPanicMode ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                No blockers, nothing due in the next 2h
              </h3>
              <p className="text-surface-500 dark:text-slate-400 mt-1 max-w-md mx-auto text-sm">
                All critical work is resolved or outside the urgent 2-hour window.
              </p>
            </>
          ) : (
            <>
              <ClipboardList className="w-14 h-14 mx-auto text-surface-300 dark:text-slate-600" />
              <h3 className="mt-4 text-lg font-semibold text-surface-900 dark:text-white">
                {rooms.length === 0 ? 'No rooms yet' : 'No tasks found'}
              </h3>
              <p className="text-surface-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {rooms.length === 0
                  ? 'Create a room first, then start adding tasks for your team.'
                  : 'Try a different filter or create a new task.'}
              </p>
              <Link
                href={rooms.length === 0 ? '/dashboard/rooms/new' : '/dashboard/tasks/new'}
                className="btn-primary mt-6"
              >
                <Plus className="w-4 h-4" />
                {rooms.length === 0 ? 'Create a room' : 'New task'}
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="card divide-y divide-surface-200 dark:divide-slate-800 overflow-hidden">
          {filtered.map((task) => (
            <Link
              key={task.id}
              href={`/dashboard/rooms/${task.room_id}/tasks/${task.id}`}
              className="flex items-center gap-4 p-4 hover:bg-surface-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <span
                className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', {
                  'bg-surface-400': task.status === 'todo',
                  'bg-blue-500': task.status === 'in_progress',
                  'bg-yellow-500': task.status === 'review',
                  'bg-green-500': task.status === 'done',
                  'bg-red-500': task.status === 'blocked',
                })}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-surface-900 dark:text-white truncate">{task.title}</p>
                  <span className={cn('badge', getTaskStatusColor(task.status))}>
                    {task.status.replace('_', ' ')}
                  </span>
                  {(task.is_blocker || task.status === 'blocked') && (
                    <span className="badge bg-red-600 text-white font-bold text-[10px]">
                      BLOCKER
                    </span>
                  )}
                </div>
                <p className="text-xs text-surface-500 dark:text-slate-300 mt-1 truncate font-medium">
                  {task.roomName} · {task.category} · {PRIORITY_LABELS[task.priority] || 'Low'} priority
                </p>
              </div>
              {task.due_date && (
                <span
                  className={cn(
                    'hidden sm:inline text-xs',
                    new Date(task.due_date).getTime() < Date.now() && task.status !== 'done'
                      ? 'text-red-600 font-medium'
                      : 'text-surface-500'
                  )}
                >
                  Due {formatRelativeTime(task.due_date)}
                </span>
              )}
              <ArrowRight className="w-4 h-4 text-surface-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
