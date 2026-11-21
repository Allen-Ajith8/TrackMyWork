import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateInviteCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function formatCurrency(amount: number | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    'Team Leader': 'bg-purple-100 text-purple-800',
    Frontend: 'bg-blue-100 text-blue-800',
    Backend: 'bg-green-100 text-green-800',
    'AI/ML': 'bg-orange-100 text-orange-800',
    'Pitch/Media': 'bg-pink-100 text-pink-800',
    'Video Editor': 'bg-red-100 text-red-800',
    Hardware: 'bg-amber-100 text-amber-800',
    Designer: 'bg-indigo-100 text-indigo-800',
    DevOps: 'bg-gray-100 text-gray-800',
    Custom: 'bg-slate-100 text-slate-800',
  };
  return colors[role] || colors.Custom;
}

export function getTaskStatusColor(status: string): string {
  const colors: Record<string, string> = {
    todo: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    review: 'bg-yellow-100 text-yellow-800',
    done: 'bg-green-100 text-green-800',
    blocked: 'bg-red-100 text-red-800',
  };
  return colors[status] || colors.todo;
}

export function getBomStatusColor(status: string): string {
  const colors: Record<string, string> = {
    planned: 'bg-gray-100 text-gray-800',
    ordered: 'bg-blue-100 text-blue-800',
    received: 'bg-green-100 text-green-800',
    installed: 'bg-purple-100 text-purple-800',
    failed: 'bg-red-100 text-red-800',
  };
  return colors[status] || colors.planned;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidInviteCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
    /github\.com\/([^\/]+)\/([^\/]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return { owner: match[1], repo: match[2].replace('.git', '') };
  }
  return null;
}

export function constructGitHubUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

/**
 * Accepts "owner/repo", "github.com/owner/repo" or a full GitHub URL and
 * returns the canonical URL stored on a room. GitHub sends canonical
 * `html_url` values in webhooks, so storing the same shape keeps matching
 * reliable.
 */
export function normalizeGitHubRepoInput(
  value: string
): { owner: string; repo: string; url: string } | null {
  let candidate = value.trim();
  if (!candidate) return null;

  candidate = candidate
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');

  if (candidate.toLowerCase().startsWith('github.com/')) {
    candidate = candidate.slice('github.com/'.length);
  }

  const parts = candidate.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  const [owner, repo] = parts;
  const validSegment = /^[A-Za-z0-9_.-]+$/;
  if (!validSegment.test(owner) || !validSegment.test(repo)) return null;

  return { owner, repo, url: constructGitHubUrl(owner, repo) };
}


// ============================================================================
// HACK-TIMER & PANIC MODE UTILITIES
// ============================================================================

import type { Task, TaskStatus } from '@/types/database';

export type HackTimerState = 'normal' | 'warning' | 'critical' | 'passed';

/**
 * Returns formatted time remaining for the Hack-Timer countdown.
 * - > 48h: DDd HHh
 * - 10m to 48h: HHh MMm
 * - < 10m: MMm SSs
 * - <= 0: "Submissions closed"
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return 'Submissions closed';

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (ms > 48 * 3600 * 1000) {
    return `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h`;
  }

  if (ms < 10 * 60 * 1000) {
    return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  const totalHours = Math.floor(totalSeconds / 3600);
  return `${String(totalHours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

/**
 * Determines timer state threshold:
 * - normal: > 6h
 * - warning: 6h to 2h
 * - critical: < 2h
 * - passed: <= 0
 */
export function getHackTimerState(ms: number): HackTimerState {
  if (ms <= 0) return 'passed';
  if (ms <= 2 * 60 * 60 * 1000) return 'critical';
  if (ms <= 6 * 60 * 60 * 1000) return 'warning';
  return 'normal';
}

export interface PanicTaskLike {
  id?: string;
  title?: string;
  status: TaskStatus | string;
  is_blocker?: boolean | null;
  due_date?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  priority?: number;
}

/**
 * Pure, unit-testable filtering and sorting function for Panic Mode.
 * - Hides all completed tasks (status === 'done' or completed_at !== null)
 * - Shows ONLY:
 *   (a) tasks flagged as blockers (is_blocker === true or status === 'blocked')
 *   (b) open tasks due within next 2 hours (due_date/due_at <= now + windowMs, including overdue)
 * - Sorts blockers first, then by due date ascending.
 */
export function getPanicTasks<T extends PanicTaskLike>(
  tasks: T[],
  now: Date | number | string,
  windowMs = 2 * 60 * 60 * 1000
): T[] {
  const nowMs =
    typeof now === 'number'
      ? now
      : now instanceof Date
      ? now.getTime()
      : new Date(now).getTime();

  return tasks
    .filter((task) => {
      // 1. Hide all completed tasks
      const isCompleted =
        task.status === 'done' || Boolean(task.completed_at);
      if (isCompleted) return false;

      // 2. Check blocker status
      const isBlocker = Boolean(task.is_blocker || task.status === 'blocked');

      // 3. Check due date
      const dueRaw = task.due_at ?? task.due_date;
      const dueMs = dueRaw ? new Date(dueRaw).getTime() : null;
      const isDueWithinWindow =
        dueMs !== null && !isNaN(dueMs) && dueMs <= nowMs + windowMs;

      return isBlocker || isDueWithinWindow;
    })
    .sort((a, b) => {
      const aBlocker = Boolean(a.is_blocker || a.status === 'blocked');
      const bBlocker = Boolean(b.is_blocker || b.status === 'blocked');

      // Blocker tasks sorted first
      if (aBlocker && !bBlocker) return -1;
      if (!aBlocker && bBlocker) return 1;

      // Then sort by due_date/due_at ascending
      const dueRawA = a.due_at ?? a.due_date;
      const dueRawB = b.due_at ?? b.due_date;
      const dueA = dueRawA ? new Date(dueRawA).getTime() : null;
      const dueB = dueRawB ? new Date(dueRawB).getTime() : null;

      if (dueA !== null && dueB !== null) {
        if (dueA !== dueB) return dueA - dueB;
      } else if (dueA !== null) {
        return -1;
      } else if (dueB !== null) {
        return 1;
      }

      // Secondary sort: priority descending
      return (Number(b.priority) || 0) - (Number(a.priority) || 0);
    });
}
