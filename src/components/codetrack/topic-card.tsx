'use client';

import { useCodeTrackStore } from '@/lib/codetrack/store';
import { getProblemsByTopic } from '@/lib/codetrack/data';
import type { DSATopic } from '@/types/codetrack';
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
};

interface TopicCardProps {
  topic: DSATopic;
  isSelected: boolean;
  onSelect: () => void;
}

export function TopicCard({ topic, isSelected, onSelect }: TopicCardProps) {
  const { progressMap } = useCodeTrackStore();
  const problems = getProblemsByTopic(topic.id);
  const total = problems.length;
  const solved = problems.filter((p) => progressMap[p.id]?.status === 'solved').length;
  const percentage = total > 0 ? Math.round((solved / total) * 100) : 0;

  const Icon = ICON_MAP[topic.iconName] || LayoutGrid;

  const levelBadge =
    topic.level === 'beginner'
      ? { text: 'Beginner', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' }
      : topic.level === 'intermediate'
      ? { text: 'Intermediate', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
      : { text: 'Advanced', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };

  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col justify-between p-5 rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'bg-zinc-900 border-purple-500/80 shadow-xl shadow-purple-500/10 ring-1 ring-purple-500/50'
          : 'bg-zinc-950/70 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
      }`}
    >
      {/* Background glow on selected */}
      {isSelected && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
      )}

      <div className="space-y-3">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
              isSelected
                ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:text-purple-400'
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>

          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${levelBadge.bg}`}>
            {levelBadge.text}
          </span>
        </div>

        {/* Title & Desc */}
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
              {topic.name}
            </h4>
            {percentage === 100 && (
              <span title="Topic Mastered!">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
            {topic.description}
          </p>
        </div>
      </div>

      {/* Progress & Problem Counts */}
      <div className="mt-5 pt-3 border-t border-zinc-900 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-mono">
            {solved}/{total} solved
          </span>
          <span className={`font-mono font-medium ${percentage > 0 ? 'text-purple-400' : 'text-zinc-500'}`}>
            {percentage}%
          </span>
        </div>

        {/* Custom progress bar */}
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-500 group-hover:text-purple-400 transition-colors">
          <span>{isSelected ? 'Viewing problems' : 'Click to view problems'}</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'rotate-90 text-purple-400' : ''}`} />
        </div>
      </div>
    </div>
  );
}
