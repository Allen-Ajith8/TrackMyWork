'use client';

import { useState } from 'react';
import { useCodeTrackStore } from '@/lib/codetrack/store';
import type { DSALevel, PreferredDifficulty } from '@/types/codetrack';
import {
  Sparkles,
  Compass,
  Flame,
  ArrowRight,
  Code2,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LEVELS = [
  {
    id: 'beginner' as DSALevel,
    title: 'Beginner',
    tagline: 'I am new to DSA',
    description: 'Master core foundations: Arrays, Strings, Two Pointers, Searching, Sorting, and Hash Maps.',
    icon: Sparkles,
    color: 'from-emerald-500 to-teal-600',
    borderHover: 'hover:border-emerald-500/80',
    activeBg: 'bg-emerald-500/10 border-emerald-500',
    badge: 'Level 1',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'intermediate' as DSALevel,
    title: 'Intermediate',
    tagline: 'I know the basics and can solve some problems',
    description: 'Level up with Sliding Window, Linked Lists, Trees, Stacks, Queues, Heaps, and Backtracking.',
    icon: Compass,
    color: 'from-amber-500 to-orange-600',
    borderHover: 'hover:border-amber-500/80',
    activeBg: 'bg-amber-500/10 border-amber-500',
    badge: 'Level 2',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'advanced' as DSALevel,
    title: 'Advanced',
    tagline: 'I can solve complex DSA problems',
    description: 'Conquer Graphs, Dynamic Programming, Greedy Algorithms, Tries, Segment Trees, and DSU.',
    icon: Flame,
    color: 'from-purple-500 to-rose-600',
    borderHover: 'hover:border-purple-500/80',
    activeBg: 'bg-purple-500/10 border-purple-500',
    badge: 'Level 3',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
];

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const { level, setLevel, preferredDifficulty, setPreferredDifficulty } = useCodeTrackStore();
  const [selected, setSelected] = useState<DSALevel>(level || 'beginner');
  const [selectedDiff, setSelectedDiff] = useState<PreferredDifficulty>(
    preferredDifficulty || 'Mixed Practice'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      setLevel(selected);
      setPreferredDifficulty(selectedDiff);

      // Persist to server profile endpoint
      await fetch('/api/codetrack/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: selected,
          preferredDifficulty: selectedDiff,
        }),
      }).catch(() => {});
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white border border-surface-200 shadow-2xl">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider">
              <Code2 className="w-3.5 h-3.5" />
              CodeTrack AI Onboarding
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-surface-900 tracking-tight">
              Hi, Developer! Welcome to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">
                CodeTrack AI
              </span>
            </h2>
            <p className="text-surface-600 text-xs sm:text-sm max-w-xl mx-auto">
              What would you like to begin with today? How would you describe your current DSA level?
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {LEVELS.map((item) => {
              const Icon = item.icon;
              const isCurrent = selected === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                  className={`group relative flex flex-col justify-between p-5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                    isCurrent
                      ? item.activeBg + ' ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/10'
                      : 'bg-white border-surface-200 hover:bg-surface-50 ' + item.borderHover
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-md`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-surface-900 group-hover:text-primary-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs font-semibold text-primary-600 mt-0.5">
                        {item.tagline}
                      </p>
                    </div>

                    <p className="text-xs text-surface-600 leading-relaxed">{item.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-surface-200 flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-mono">
                      {isCurrent ? 'Selected' : 'Click to select'}
                    </span>
                    {isCurrent && (
                      <CheckCircle2 className="w-4 h-4 text-purple-400 animate-in zoom-in-50 duration-150" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Target Difficulty Selector */}
          <div className="p-4 rounded-2xl bg-surface-50 border border-surface-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-surface-800 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                <span>Preferred Target Difficulty:</span>
              </span>
              <span className="text-xs text-zinc-500 font-mono">Can change anytime</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              {(['Easy', 'Medium', 'Hard', 'Mixed Practice'] as PreferredDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDiff(d)}
                  className={`p-2 rounded-xl font-bold transition-all ${
                    selectedDiff === d
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white border border-surface-200 text-surface-700 hover:text-surface-900 shadow-xs'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-2 border-t border-surface-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-zinc-500 text-center sm:text-left">
              Progress, attempts, and streaks persist across sessions and profile switches.
            </p>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Saving...' : 'Enter Learning Workspace'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
