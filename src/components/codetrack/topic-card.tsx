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
      ? { text: 'Beginner', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      : topic.level === 'intermediate'
      ? { text: 'Intermediate', bg: 'bg-amber-50 text-amber-700 border-amber-200' }
      : { text: 'Advanced', bg: 'bg-purple-50 text-purple-700 border-purple-200' };

  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col justify-between p-5 rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'bg-primary-50/50 border-primary-400 shadow-sm ring-2 ring-primary-500/20'
          : 'bg-white border-surface-200 hover:border-surface-300 hover:shadow-sm'
      }`}
    >
      <div className="space-y-3">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
              isSelected
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-surface-100 border border-surface-200 text-surface-600 group-hover:text-primary-600'
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
            <h4 className="text-base font-bold text-surface-900 group-hover:text-primary-600 transition-colors">
              {topic.name}
            </h4>
            {percentage === 100 && (
              <span title="Topic Mastered!">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </span>
            )}
          </div>
          <p className="text-xs text-surface-600 mt-1 line-clamp-2 leading-relaxed">
            {topic.description}
          </p>
        </div>
      </div>

      {/* Progress & Problem Counts */}
      <div className="mt-5 pt-3 border-t border-surface-100 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-500 font-mono">
            {solved}/{total} solved
          </span>
          <span className={`font-mono font-medium ${percentage > 0 ? 'text-primary-600' : 'text-surface-500'}`}>
            {percentage}%
          </span>
        </div>

        {/* Custom progress bar */}
        <div className="w-full h-1.5 bg-surface-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="pt-1 flex items-center justify-between text-[11px] text-surface-500 group-hover:text-primary-600 transition-colors">
          <span>{isSelected ? 'Viewing problems' : 'Click to view problems'}</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'rotate-90 text-primary-600' : ''}`} />
        </div>
      </div>
    </div>
  );
}
