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
import { cn, formatRelativeTime, getTaskStatusColor } from '@/lib/utils';
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

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: tasks.length };
    for (const task of tasks) {
      result[task.status] = (result[task.status] || 0) + 1;
    }
    return result;
  }, [tasks]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesStatus = status === 'all' || task.status === status;
      const matchesQuery =
        !needle ||
        task.title.toLowerCase().includes(needle) ||
        task.roomName.toLowerCase().includes(needle) ||
        task.category.toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [tasks, status, query]);

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
          <h1 className="text-2xl font-bold text-surface-900">Tasks</h1>
          <p className="text-surface-600 mt-1">
            Every task across your rooms, in one place.
          </p>
        </div>
        <Link href="/dashboard/tasks/new" className="btn-primary">
          <Plus className="w-5 h-5" />
          New Task
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm text-surface-500">Open tasks</p>
            <p className="text-2xl font-bold text-surface-900">{activeCount}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-500 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm text-surface-500">Completed</p>
            <p className="text-2xl font-bold text-surface-900">{counts.done || 0}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-500 flex items-center justify-center">
            <SlidersHorizontal className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm text-surface-500">Overdue</p>
            <p className="text-2xl font-bold text-surface-900">{overdueCount}</p>
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
                  : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
              )}
            >
              {filter.label}
              <span
                className={cn(
                  'ml-2 text-xs',
                  status === filter.id ? 'text-white/80' : 'text-surface-400'
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
          <ClipboardList className="w-14 h-14 mx-auto text-surface-300" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900">
            {rooms.length === 0 ? 'No rooms yet' : 'No tasks found'}
          </h3>
          <p className="text-surface-500 mt-1 max-w-md mx-auto">
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
        </div>
      ) : (
        <div className="card divide-y divide-surface-200 overflow-hidden">
          {filtered.map((task) => (
            <Link
              key={task.id}
              href={`/dashboard/rooms/${task.room_id}/tasks/${task.id}`}
              className="flex items-center gap-4 p-4 hover:bg-surface-50 transition-colors"
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
                  <p className="font-medium text-surface-900 truncate">{task.title}</p>
                  <span className={cn('badge', getTaskStatusColor(task.status))}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-surface-500 mt-1 truncate">
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
