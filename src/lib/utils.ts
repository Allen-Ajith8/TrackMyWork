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