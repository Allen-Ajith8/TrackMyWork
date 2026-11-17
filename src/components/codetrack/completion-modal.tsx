'use client';

import { useState } from 'react';
import { useCodeTrackStore } from '@/lib/codetrack/store';
import type { LeetCodeProblem, ProblemStatus } from '@/types/codetrack';
import {
  CheckCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  X,
  Sparkles,
} from 'lucide-react';

interface CompletionModalProps {
  problem: LeetCodeProblem | null;
  onClose: () => void;
}

export function CompletionModal({ problem, onClose }: CompletionModalProps) {
  const { progressMap, updateProblemProgress } = useCodeTrackStore();
  const currentProgress = problem ? progressMap[problem.id] : undefined;

  const [selectedStatus, setSelectedStatus] = useState<ProblemStatus>(
    currentProgress?.status || 'solved'
  );
  const [notes, setNotes] = useState(currentProgress?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!problem) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      updateProblemProgress({
        problemId: problem.id,
        topicId: problem.topicId,
        difficulty: problem.difficulty,
        status: selectedStatus,
        notes,
      });

      // Persist to server
      await fetch('/api/codetrack/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          topicId: problem.topicId,
          difficulty: problem.difficulty,
          status: selectedStatus,
          notes,
        }),
      }).catch(() => {});
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  const currentAttempts = (currentProgress?.attempts || 0) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-purple-500 to-indigo-500" />

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-mono text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Problem Completion Tracker
              </span>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {problem.title}
              </h3>
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span
                  className={`px-2 py-0.5 rounded-full font-medium ${
                    problem.difficulty === 'Easy'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : problem.difficulty === 'Medium'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {problem.difficulty}
                </span>
                <span className="text-zinc-500 font-mono">Attempt #{currentAttempts}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Question Prompt */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-200">
              How did you perform on this problem?
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: Solved */}
              <button
                type="button"
                onClick={() => setSelectedStatus('solved')}
                className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                  selectedStatus === 'solved'
                    ? 'bg-emerald-500/15 border-emerald-500 text-white ring-1 ring-emerald-500/40 shadow-sm'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Solved</p>
                    <p className="text-xs text-zinc-400">Accepted solution on LeetCode with full test pass</p>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedStatus === 'solved'
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-zinc-700'
                  }`}
                >
                  {selectedStatus === 'solved' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>
              </button>

              {/* Option 2: Attempted */}
              <button
                type="button"
                onClick={() => setSelectedStatus('attempted')}
                className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                  selectedStatus === 'attempted'
                    ? 'bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500/40 shadow-sm'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Attempted</p>
                    <p className="text-xs text-zinc-400">Wrote code / tackled test cases, still in progress</p>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedStatus === 'attempted'
                      ? 'border-amber-500 bg-amber-500'
                      : 'border-zinc-700'
                  }`}
                >
                  {selectedStatus === 'attempted' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>
              </button>

              {/* Option 3: Need More Practice */}
              <button
                type="button"
                onClick={() => setSelectedStatus('practice')}
                className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                  selectedStatus === 'practice'
                    ? 'bg-purple-500/15 border-purple-500 text-white ring-1 ring-purple-500/40 shadow-sm'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Need More Practice</p>
                    <p className="text-xs text-zinc-400">Struggled with the optimal pattern, want to revisit</p>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedStatus === 'practice'
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-zinc-700'
                  }`}
                >
                  {selectedStatus === 'practice' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>
              </button>
            </div>
          </div>

          {/* Optional notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              Personal Notes / Key Takeaways (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Kadane's algorithm resets when sum < 0. Space O(1)."
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <a
              href={problem.leetcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700 underline-offset-4"
            >
              Reopen on LeetCode
              <ExternalLink className="w-3 h-3" />
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg shadow-md shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Status'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
