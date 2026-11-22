'use client';

import { useCodeTrackStore } from '@/lib/codetrack/store';
import { getProblemsByTopic } from '@/lib/codetrack/data';
import type { DSATopic } from '@/types/codetrack';
import { GlassIconTile } from '@/components/ui/glass-icons';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Type,
  Search,
  ArrowUpDown,
  Hash,
  Split,
  GitFork,
  Maximize2,
  Binary,
  Link,
  Layers,
  GitCommit,
  Network,
  Database,
  CornerDownLeft,
  Share2,
  Sparkles,
  Compass,
  FolderTree,
  Activity,
  BarChart2,
  Unlink,
  CheckCircle2,
  ChevronRight,
  PlusCircle,
  Sliders,
  Calculator,
  ListOrdered,
  Repeat,
  Scissors,
  ArrowRightCircle,
  Waves,
  CornerRightDown,
  Navigation,
  Grid,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  LayoutGrid,
  Type,
  Search,
  ArrowUpDown,
  Hash,
  Split,
  GitFork,
  Maximize2,
  Binary,
  Link,
  Layers,
  GitCommit,
  Network,
  Database,
  CornerDownLeft,
  Share2,
  Sparkles,
  Compass,
  FolderTree,
  Activity,
  BarChart2,
  Unlink,
  PlusCircle,
  Sliders,
  Calculator,
  ListOrdered,
  Repeat,
  Scissors,
  ArrowRightCircle,
  Waves,
  CornerRightDown,
  Navigation,
  Grid,
};

interface TopicTheme {
  bgClass: string;
  glowClass: string;
  borderClass: string;
  selectedRing: string;
  glassColor: 'blue' | 'purple' | 'orange' | 'green' | 'teal' | 'indigo' | 'pink' | 'red';
  progressGradient: string;
  watermark: string;
  accentText: string;
}

const TOPIC_THEMES: Record<string, TopicTheme> = {
  arrays: {
    bgClass: 'bg-gradient-to-br from-[#eff6ff] via-[#f8faff] to-[#e0e7ff] dark:from-[#11192e] dark:via-[#0c1424] dark:to-[#080d19]',
    glowClass: 'bg-blue-400/20 dark:bg-blue-500/15',
    borderClass: 'border-blue-200/90 hover:border-blue-400/80 dark:border-blue-900/50 dark:hover:border-blue-600/70',
    selectedRing: 'ring-2 ring-blue-500/40 border-blue-400 dark:border-blue-500',
    glassColor: 'blue',
    progressGradient: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    watermark: '[ 0 .. N ]',
    accentText: 'text-blue-600 dark:text-blue-400',
  },
  strings: {
    bgClass: 'bg-gradient-to-br from-[#faf5ff] via-[#fdf4ff] to-[#f3e8ff] dark:from-[#26153c] dark:via-[#190d29] dark:to-[#0f071a]',
    glowClass: 'bg-purple-400/20 dark:bg-purple-500/20',
    borderClass: 'border-purple-200/90 hover:border-purple-400/80 dark:border-purple-900/50 dark:hover:border-purple-600/70',
    selectedRing: 'ring-2 ring-purple-500/40 border-purple-400 dark:border-purple-500',
    glassColor: 'purple',
    progressGradient: 'bg-gradient-to-r from-purple-500 to-pink-500',
    watermark: '"A .. Z"',
    accentText: 'text-purple-600 dark:text-purple-400',
  },
  'hash-tables': {
    bgClass: 'bg-gradient-to-br from-[#fffbeb] via-[#fffdf5] to-[#fef3c7] dark:from-[#352511] dark:via-[#261909] dark:to-[#170e04]',
    glowClass: 'bg-amber-400/20 dark:bg-amber-500/20',
    borderClass: 'border-amber-200/90 hover:border-amber-400/80 dark:border-amber-900/50 dark:hover:border-amber-600/70',
    selectedRing: 'ring-2 ring-amber-500/40 border-amber-400 dark:border-amber-500',
    glassColor: 'orange',
    progressGradient: 'bg-gradient-to-r from-amber-500 to-orange-500',
    watermark: '# HASH',
    accentText: 'text-amber-600 dark:text-amber-400',
  },
  'linked-lists': {
    bgClass: 'bg-gradient-to-br from-[#ecfdf5] via-[#f6fef9] to-[#d1fae5] dark:from-[#0b281d] dark:via-[#071d15] dark:to-[#04120d]',
    glowClass: 'bg-emerald-400/20 dark:bg-emerald-500/20',
    borderClass: 'border-emerald-200/90 hover:border-emerald-400/80 dark:border-emerald-900/50 dark:hover:border-emerald-600/70',
    selectedRing: 'ring-2 ring-emerald-500/40 border-emerald-400 dark:border-emerald-500',
    glassColor: 'green',
    progressGradient: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    watermark: 'NODE ->',
    accentText: 'text-emerald-600 dark:text-emerald-400',
  },
  stack: {
    bgClass: 'bg-gradient-to-br from-[#fff1f2] via-[#fff5f5] to-[#ffe4e6] dark:from-[#331118] dark:via-[#240a10] dark:to-[#150509]',
    glowClass: 'bg-rose-400/20 dark:bg-rose-500/20',
    borderClass: 'border-rose-200/90 hover:border-rose-400/80 dark:border-rose-900/50 dark:hover:border-rose-600/70',
    selectedRing: 'ring-2 ring-rose-500/40 border-rose-400 dark:border-rose-500',
    glassColor: 'red',
    progressGradient: 'bg-gradient-to-r from-rose-500 to-red-500',
    watermark: 'LIFO TOP',
    accentText: 'text-rose-600 dark:text-rose-400',
  },
  queue: {
    bgClass: 'bg-gradient-to-br from-[#f5f3ff] via-[#faf5ff] to-[#ede9fe] dark:from-[#22133d] dark:via-[#160c28] dark:to-[#0d071a]',
    glowClass: 'bg-indigo-400/20 dark:bg-indigo-500/20',
    borderClass: 'border-indigo-200/90 hover:border-indigo-400/80 dark:border-indigo-900/50 dark:hover:border-indigo-600/70',
    selectedRing: 'ring-2 ring-indigo-500/40 border-indigo-400 dark:border-indigo-500',
    glassColor: 'indigo',
    progressGradient: 'bg-gradient-to-r from-indigo-500 to-purple-600',
    watermark: 'FIFO >>',
    accentText: 'text-indigo-600 dark:text-indigo-400',
  },
  'binary-trees': {
    bgClass: 'bg-gradient-to-br from-[#f0fdfa] via-[#f6feff] to-[#ccfbf1] dark:from-[#0c2826] dark:via-[#071c1b] dark:to-[#041110]',
    glowClass: 'bg-teal-400/20 dark:bg-teal-500/20',
    borderClass: 'border-teal-200/90 hover:border-teal-400/80 dark:border-teal-900/50 dark:hover:border-teal-600/70',
    selectedRing: 'ring-2 ring-teal-500/40 border-teal-400 dark:border-teal-500',
    glassColor: 'teal',
    progressGradient: 'bg-gradient-to-r from-teal-500 to-emerald-500',
    watermark: 'TREE DFS',
    accentText: 'text-teal-600 dark:text-teal-400',
  },
  'binary-search-trees': {
    bgClass: 'bg-gradient-to-br from-[#ecfeff] via-[#f0f9ff] to-[#cffafe] dark:from-[#0a2630] dark:via-[#061a22] dark:to-[#031015]',
    glowClass: 'bg-cyan-400/20 dark:bg-cyan-500/20',
    borderClass: 'border-cyan-200/90 hover:border-cyan-400/80 dark:border-cyan-900/50 dark:hover:border-cyan-600/70',
    selectedRing: 'ring-2 ring-cyan-500/40 border-cyan-400 dark:border-cyan-500',
    glassColor: 'blue',
    progressGradient: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    watermark: '< ROOT >',
    accentText: 'text-cyan-600 dark:text-cyan-400',
  },
  'heaps-priority-queue': {
    bgClass: 'bg-gradient-to-br from-[#fff7ed] via-[#fffbf5] to-[#fed7aa] dark:from-[#35210c] dark:via-[#251607] dark:to-[#170c03]',
    glowClass: 'bg-orange-400/20 dark:bg-orange-500/20',
    borderClass: 'border-orange-200/90 hover:border-orange-400/80 dark:border-orange-900/50 dark:hover:border-orange-600/70',
    selectedRing: 'ring-2 ring-orange-500/40 border-orange-400 dark:border-orange-500',
    glassColor: 'orange',
    progressGradient: 'bg-gradient-to-r from-orange-500 to-amber-500',
    watermark: 'HEAP TOP',
    accentText: 'text-orange-600 dark:text-orange-400',
  },
  matrix: {
    bgClass: 'bg-gradient-to-br from-[#fdf4ff] via-[#faf5ff] to-[#f5d0fe] dark:from-[#2e1039] dark:via-[#1e0a26] dark:to-[#120517]',
    glowClass: 'bg-fuchsia-400/20 dark:bg-fuchsia-500/20',
    borderClass: 'border-fuchsia-200/90 hover:border-fuchsia-400/80 dark:border-fuchsia-900/50 dark:hover:border-fuchsia-600/70',
    selectedRing: 'ring-2 ring-fuchsia-500/40 border-fuchsia-400 dark:border-fuchsia-500',
    glassColor: 'pink',
    progressGradient: 'bg-gradient-to-r from-fuchsia-500 to-pink-500',
    watermark: '[ M x N ]',
    accentText: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  'two-pointers': {
    bgClass: 'bg-gradient-to-br from-[#f0f9ff] via-[#f8fbff] to-[#e0f2fe] dark:from-[#0d223a] dark:via-[#081829] dark:to-[#040e19]',
    glowClass: 'bg-sky-400/20 dark:bg-sky-500/20',
    borderClass: 'border-sky-200/90 hover:border-sky-400/80 dark:border-sky-900/50 dark:hover:border-sky-600/70',
    selectedRing: 'ring-2 ring-sky-500/40 border-sky-400 dark:border-sky-500',
    glassColor: 'blue',
    progressGradient: 'bg-gradient-to-r from-sky-500 to-blue-500',
    watermark: 'L <--> R',
    accentText: 'text-sky-600 dark:text-sky-400',
  },
  'sliding-window': {
    bgClass: 'bg-gradient-to-br from-[#f7fee7] via-[#fafdf5] to-[#d9f99d] dark:from-[#1b2b0a] dark:via-[#131f06] dark:to-[#0a1203]',
    glowClass: 'bg-lime-400/20 dark:bg-lime-500/20',
    borderClass: 'border-lime-200/90 hover:border-lime-400/80 dark:border-lime-900/50 dark:hover:border-lime-600/70',
    selectedRing: 'ring-2 ring-lime-500/40 border-lime-400 dark:border-lime-500',
    glassColor: 'teal',
    progressGradient: 'bg-gradient-to-r from-lime-500 to-emerald-500',
    watermark: '[ WINDOW ]',
    accentText: 'text-lime-600 dark:text-lime-400',
  },
  'prefix-sum': {
    bgClass: 'bg-gradient-to-br from-[#eff6ff] via-[#f5f3ff] to-[#e0e7ff] dark:from-[#13192f] dark:via-[#0e1427] dark:to-[#090e1c]',
    glowClass: 'bg-indigo-400/20 dark:bg-indigo-500/20',
    borderClass: 'border-indigo-200/90 hover:border-indigo-400/80 dark:border-indigo-900/50 dark:hover:border-indigo-600/70',
    selectedRing: 'ring-2 ring-indigo-500/40 border-indigo-400 dark:border-indigo-500',
    glassColor: 'indigo',
    progressGradient: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    watermark: 'SUM(0..I)',
    accentText: 'text-indigo-600 dark:text-indigo-400',
  },
  'difference-array': {
    bgClass: 'bg-gradient-to-br from-[#f5f3ff] via-[#f8faff] to-[#ddd6fe] dark:from-[#1b1535] dark:via-[#120f24] dark:to-[#0a0815]',
    glowClass: 'bg-purple-400/20 dark:bg-purple-500/20',
    borderClass: 'border-purple-200/90 hover:border-purple-400/80 dark:border-purple-900/50 dark:hover:border-purple-600/70',
    selectedRing: 'ring-2 ring-purple-500/40 border-purple-400 dark:border-purple-500',
    glassColor: 'purple',
    progressGradient: 'bg-gradient-to-r from-purple-500 to-indigo-500',
    watermark: 'DELTA [I]',
    accentText: 'text-purple-600 dark:text-purple-400',
  },
  'binary-search': {
    bgClass: 'bg-gradient-to-br from-[#f0fdfa] via-[#f0f9ff] to-[#e0f2fe] dark:from-[#092230] dark:via-[#061824] dark:to-[#041019]',
    glowClass: 'bg-sky-400/20 dark:bg-sky-500/20',
    borderClass: 'border-sky-200/90 hover:border-sky-400/80 dark:border-sky-900/50 dark:hover:border-sky-600/70',
    selectedRing: 'ring-2 ring-sky-500/40 border-sky-400 dark:border-sky-500',
    glassColor: 'blue',
    progressGradient: 'bg-gradient-to-r from-cyan-500 to-blue-600',
    watermark: 'O(LOG N)',
    accentText: 'text-sky-600 dark:text-sky-400',
  },
  sorting: {
    bgClass: 'bg-gradient-to-br from-[#eff6ff] via-[#f8faff] to-[#dbeafe] dark:from-[#101b33] dark:via-[#0c1426] dark:to-[#070c18]',
    glowClass: 'bg-blue-400/20 dark:bg-blue-500/20',
    borderClass: 'border-blue-200/90 hover:border-blue-400/80 dark:border-blue-900/50 dark:hover:border-blue-600/70',
    selectedRing: 'ring-2 ring-blue-500/40 border-blue-400 dark:border-blue-500',
    glassColor: 'blue',
    progressGradient: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    watermark: 'A <= B',
    accentText: 'text-blue-600 dark:text-blue-400',
  },
  counting: {
    bgClass: 'bg-gradient-to-br from-[#ecfdf5] via-[#f6fef9] to-[#d1fae5] dark:from-[#0b281d] dark:via-[#071d15] dark:to-[#04120d]',
    glowClass: 'bg-emerald-400/20 dark:bg-emerald-500/20',
    borderClass: 'border-emerald-200/90 hover:border-emerald-400/80 dark:border-emerald-900/50 dark:hover:border-emerald-600/70',
    selectedRing: 'ring-2 ring-emerald-500/40 border-emerald-400 dark:border-emerald-500',
    glassColor: 'green',
    progressGradient: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    watermark: 'COUNT++',
    accentText: 'text-emerald-600 dark:text-emerald-400',
  },
  enumeration: {
    bgClass: 'bg-gradient-to-br from-[#fffbeb] via-[#fffdf5] to-[#fef3c7] dark:from-[#352511] dark:via-[#261909] dark:to-[#170e04]',
    glowClass: 'bg-amber-400/20 dark:bg-amber-500/20',
    borderClass: 'border-amber-200/90 hover:border-amber-400/80 dark:border-amber-900/50 dark:hover:border-amber-600/70',
    selectedRing: 'ring-2 ring-amber-500/40 border-amber-400 dark:border-amber-500',
    glassColor: 'orange',
    progressGradient: 'bg-gradient-to-r from-amber-500 to-orange-500',
    watermark: 'FOR ALL',
    accentText: 'text-amber-600 dark:text-amber-400',
  },
  'string-matching': {
    bgClass: 'bg-gradient-to-br from-[#faf5ff] via-[#fdf4ff] to-[#f3e8ff] dark:from-[#26153c] dark:via-[#190d29] dark:to-[#0f071a]',
    glowClass: 'bg-purple-400/20 dark:bg-purple-500/20',
    borderClass: 'border-purple-200/90 hover:border-purple-400/80 dark:border-purple-900/50 dark:hover:border-purple-600/70',
    selectedRing: 'ring-2 ring-purple-500/40 border-purple-400 dark:border-purple-500',
    glassColor: 'purple',
    progressGradient: 'bg-gradient-to-r from-purple-500 to-indigo-600',
    watermark: 'KMP PAT',
    accentText: 'text-purple-600 dark:text-purple-400',
  },
  'dynamic-programming': {
    bgClass: 'bg-gradient-to-br from-[#fdf2f8] via-[#faf5ff] to-[#fce7f3] dark:from-[#321226] dark:via-[#220a19] dark:to-[#14050e]',
    glowClass: 'bg-pink-400/20 dark:bg-pink-500/20',
    borderClass: 'border-pink-200/90 hover:border-pink-400/80 dark:border-pink-900/50 dark:hover:border-pink-600/70',
    selectedRing: 'ring-2 ring-pink-500/40 border-pink-400 dark:border-pink-500',
    glassColor: 'pink',
    progressGradient: 'bg-gradient-to-r from-pink-500 to-purple-600',
    watermark: 'MEMO [I]',
    accentText: 'text-pink-600 dark:text-pink-400',
  },
  backtracking: {
    bgClass: 'bg-gradient-to-br from-[#fff7ed] via-[#ffedd5] to-[#fed7aa] dark:from-[#331c0d] dark:via-[#241308] dark:to-[#160a04]',
    glowClass: 'bg-orange-400/20 dark:bg-orange-500/20',
    borderClass: 'border-orange-200/90 hover:border-orange-400/80 dark:border-orange-900/50 dark:hover:border-orange-600/70',
    selectedRing: 'ring-2 ring-orange-500/40 border-orange-400 dark:border-orange-500',
    glassColor: 'orange',
    progressGradient: 'bg-gradient-to-r from-orange-500 to-amber-500',
    watermark: 'PRUNE',
    accentText: 'text-orange-600 dark:text-orange-400',
  },
  greedy: {
    bgClass: 'bg-gradient-to-br from-[#ecfdf5] via-[#f0fdf4] to-[#bbf7d0] dark:from-[#0e2c1a] dark:via-[#091f12] dark:to-[#05130a]',
    glowClass: 'bg-green-400/20 dark:bg-green-500/20',
    borderClass: 'border-green-200/90 hover:border-green-400/80 dark:border-green-900/50 dark:hover:border-green-600/70',
    selectedRing: 'ring-2 ring-green-500/40 border-green-400 dark:border-green-500',
    glassColor: 'green',
    progressGradient: 'bg-gradient-to-r from-emerald-500 to-green-600',
    watermark: 'OPT GAIN',
    accentText: 'text-green-600 dark:text-green-400',
  },
  'graph-theory': {
    bgClass: 'bg-gradient-to-br from-[#eef2ff] via-[#f8faff] to-[#c7d2fe] dark:from-[#15193b] dark:via-[#0e1128] dark:to-[#070918]',
    glowClass: 'bg-indigo-400/20 dark:bg-indigo-500/20',
    borderClass: 'border-indigo-200/90 hover:border-indigo-400/80 dark:border-indigo-900/50 dark:hover:border-indigo-600/70',
    selectedRing: 'ring-2 ring-indigo-500/40 border-indigo-400 dark:border-indigo-500',
    glassColor: 'indigo',
    progressGradient: 'bg-gradient-to-r from-indigo-500 to-blue-600',
    watermark: 'G = (V,E)',
    accentText: 'text-indigo-600 dark:text-indigo-400',
  },
};

const DEFAULT_THEME_PALETTE: TopicTheme[] = [
  {
    bgClass: 'bg-gradient-to-br from-[#eff6ff] via-[#f8faff] to-[#e0e7ff] dark:from-[#11192e] dark:via-[#0c1424] dark:to-[#080d19]',
    glowClass: 'bg-blue-400/20 dark:bg-blue-500/15',
    borderClass: 'border-blue-200/90 hover:border-blue-400/80 dark:border-blue-900/50 dark:hover:border-blue-600/70',
    selectedRing: 'ring-2 ring-blue-500/40 border-blue-400 dark:border-blue-500',
    glassColor: 'blue',
    progressGradient: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    watermark: 'ALGO',
    accentText: 'text-blue-600 dark:text-blue-400',
  },
  {
    bgClass: 'bg-gradient-to-br from-[#faf5ff] via-[#fdf4ff] to-[#f3e8ff] dark:from-[#26153c] dark:via-[#190d29] dark:to-[#0f071a]',
    glowClass: 'bg-purple-400/20 dark:bg-purple-500/20',
    borderClass: 'border-purple-200/90 hover:border-purple-400/80 dark:border-purple-900/50 dark:hover:border-purple-600/70',
    selectedRing: 'ring-2 ring-purple-500/40 border-purple-400 dark:border-purple-500',
    glassColor: 'purple',
    progressGradient: 'bg-gradient-to-r from-purple-500 to-pink-500',
    watermark: 'PATTERN',
    accentText: 'text-purple-600 dark:text-purple-400',
  },
  {
    bgClass: 'bg-gradient-to-br from-[#ecfdf5] via-[#f6fef9] to-[#d1fae5] dark:from-[#0b281d] dark:via-[#071d15] dark:to-[#04120d]',
    glowClass: 'bg-emerald-400/20 dark:bg-emerald-500/20',
    borderClass: 'border-emerald-200/90 hover:border-emerald-400/80 dark:border-emerald-900/50 dark:hover:border-emerald-600/70',
    selectedRing: 'ring-2 ring-emerald-500/40 border-emerald-400 dark:border-emerald-500',
    glassColor: 'green',
    progressGradient: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    watermark: 'SOLVE',
    accentText: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    bgClass: 'bg-gradient-to-br from-[#fffbeb] via-[#fffdf5] to-[#fef3c7] dark:from-[#352511] dark:via-[#261909] dark:to-[#170e04]',
    glowClass: 'bg-amber-400/20 dark:bg-amber-500/20',
    borderClass: 'border-amber-200/90 hover:border-amber-400/80 dark:border-amber-900/50 dark:hover:border-amber-600/70',
    selectedRing: 'ring-2 ring-amber-500/40 border-amber-400 dark:border-amber-500',
    glassColor: 'orange',
    progressGradient: 'bg-gradient-to-r from-amber-500 to-orange-500',
    watermark: 'OPTIMAL',
    accentText: 'text-amber-600 dark:text-amber-400',
  },
];

interface TopicCardProps {
  topic: DSATopic;
  isSelected: boolean;
  onSelect: () => void;
  onOpenVault?: () => void;
}

export function TopicCard({ topic, isSelected, onSelect, onOpenVault }: TopicCardProps) {
  const { progressMap } = useCodeTrackStore();
  const problems = getProblemsByTopic(topic.id);
  const total = problems.length;
  const solved = problems.filter((p) => progressMap[p.id]?.status === 'solved').length;
  const percentage = total > 0 ? Math.round((solved / total) * 100) : 0;

  const Icon = ICON_MAP[topic.iconName] || LayoutGrid;

  const theme: TopicTheme =
    TOPIC_THEMES[topic.id] ||
    DEFAULT_THEME_PALETTE[(topic.orderIndex || 0) % DEFAULT_THEME_PALETTE.length];

  const levelBadge =
    topic.level === 'beginner'
      ? {
          text: 'Beginner',
          bg: 'bg-emerald-50/90 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
        }
      : topic.level === 'intermediate'
      ? {
          text: 'Intermediate',
          bg: 'bg-amber-50/90 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
        }
      : {
          text: 'Advanced',
          bg: 'bg-purple-50/90 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60',
        };

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col justify-between p-5 rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5',
        theme.bgClass,
        isSelected
          ? cn('shadow-md ring-2', theme.selectedRing)
          : cn('hover:shadow-md', theme.borderClass)
      )}
    >
      {/* Ambient diffuse colored glow in top-right */}
      <div
        className={cn(
          'absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125',
          theme.glowClass
        )}
      />

      {/* Algorithmic subtle watermark in top-right corner */}
      <div className="absolute right-4 top-14 select-none pointer-events-none font-mono text-[10px] font-bold tracking-widest text-slate-400/25 dark:text-white/10 uppercase transition-opacity group-hover:opacity-60">
        {theme.watermark}
      </div>

      <div className="relative z-10 space-y-3">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="shrink-0 transition-transform group-hover:scale-105">
            <GlassIconTile
              icon={<Icon className="w-4 h-4 text-white" />}
              color={theme.glassColor}
              size={38}
              roundness={0.55}
              plate="offset"
              hover="lift"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenVault) onOpenVault();
                else onSelect();
              }}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 text-purple-700 border border-purple-200/80 hover:bg-white dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60 dark:hover:bg-purple-900/60 flex items-center gap-1 transition-all shadow-2xs hover:scale-105 active:scale-95 backdrop-blur-xs"
              title={`Open 3D ${topic.name} Box`}
            >
              <Sparkles className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
              <span>3D Box</span>
            </button>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${levelBadge.bg}`}>
              {levelBadge.text}
            </span>
          </div>
        </div>

        {/* Title & Desc */}
        <div>
          <div className="flex items-center justify-between">
            <h4
              className={cn(
                'text-base font-bold text-surface-900 dark:text-white transition-colors',
                isSelected && theme.accentText
              )}
            >
              {topic.name}
            </h4>
            {percentage === 100 && (
              <span title="Topic Mastered!">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </span>
            )}
          </div>
          <p className="text-xs text-surface-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {topic.description}
          </p>
        </div>
      </div>

      {/* Progress & Problem Counts */}
      <div className="relative z-10 mt-5 pt-3 border-t border-surface-200/60 dark:border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-600 dark:text-slate-400 font-mono font-medium">
            {solved}/{total} solved
          </span>
          <span
            className={cn(
              'font-mono font-semibold',
              percentage > 0 ? theme.accentText : 'text-surface-500 dark:text-slate-500'
            )}
          >
            {percentage}%
          </span>
        </div>

        {/* Custom progress bar */}
        <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', theme.progressGradient)}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="pt-1 flex items-center justify-between text-[11px] text-surface-500 dark:text-slate-400 group-hover:text-surface-900 dark:group-hover:text-white transition-colors">
          <span>{isSelected ? 'Viewing problems' : 'Click to view problems'}</span>
          <ChevronRight
            className={cn(
              'w-3.5 h-3.5 transition-transform',
              isSelected && 'rotate-90 text-primary-600 dark:text-purple-400'
            )}
          />
        </div>
      </div>
    </div>
  );
}
