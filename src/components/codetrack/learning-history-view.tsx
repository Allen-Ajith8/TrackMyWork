'use client';

import { useCodeTrackStore } from '@/lib/codetrack/store';
import { LEETCODE_PROBLEMS, DSA_TOPICS } from '@/lib/codetrack/data';
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
  Bot,
  Brain,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Award,
} from 'lucide-react';

export function LearningHistoryView() {
  const { progressMap, setActiveDebriefProblem } = useCodeTrackStore();

  const historyEntries = Object.values(progressMap).sort(
    (a, b) =>
      new Date(b.lastAttemptedAt || 0).getTime() - new Date(a.lastAttemptedAt || 0).getTime()
  );

  const solvedCount = historyEntries.filter((p) => p.status === 'solved').length;
  const independentCount = historyEntries.filter((p) => p.independence === 'independent').length;
  const assistedCount = historyEntries.filter(
    (p) => p.independence === 'small_hint' || p.independence === 'substantial_help'
  ).length;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Attempted / Solved Logs</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-2xl font-bold text-white">{historyEntries.length}</span>
          <p className="text-[11px] text-zinc-500 font-mono">{solvedCount} marked as solved</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Independent Mastery</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-white">{independentCount}</span>
          <p className="text-[11px] text-zinc-500 font-mono">Solved without hints</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Assisted Practice</span>
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-bold text-white">{assistedCount}</span>
          <p className="text-[11px] text-zinc-500 font-mono">Solved with clues/help</p>
        </div>
      </div>

      {/* History Table */}
      <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-bold text-white">Problem Attempt &amp; Debrief Ledger</h4>
            <p className="text-xs text-zinc-400">
              Detailed record of independence ratings, hurdles faced, and confidence scores
            </p>
          </div>
          <Brain className="w-5 h-5 text-purple-400" />
        </div>

        {historyEntries.length > 0 ? (
          <div className="divide-y divide-zinc-900 overflow-x-auto">
            {historyEntries.map((entry) => {
              const prob = LEETCODE_PROBLEMS.find((p) => p.id === entry.problemId);
              const title = prob ? prob.title : entry.problemId;
              const frontendId = prob ? prob.frontendQuestionId : '';
              const dateStr = entry.lastAttemptedAt
                ? new Date(entry.lastAttemptedAt).toLocaleDateString()
                : 'Recent';

              return (
                <div
                  key={entry.problemId}
                  className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {frontendId && (
                        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-[11px] font-bold text-zinc-400">
                          #{frontendId}
                        </span>
                      )}
                      <h5 className="text-sm font-bold text-white">{title}</h5>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          entry.difficulty === 'Easy'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : entry.difficulty === 'Medium'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {entry.difficulty}
                      </span>
                      <span className="text-zinc-500 font-mono text-[11px]">{dateStr}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
                      {entry.independence && (
                        <span>
                          Independence:{' '}
                          <strong className="text-zinc-200 capitalize">
                            {entry.independence.replace('_', ' ')}
                          </strong>
                        </span>
                      )}
                      {entry.confidence && (
                        <span>
                          Confidence:{' '}
                          <strong
                            className={
                              entry.confidence === 'high'
                                ? 'text-emerald-400'
                                : entry.confidence === 'medium'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }
                          >
                            {entry.confidence.toUpperCase()}
                          </strong>
                        </span>
                      )}
                      {entry.attempts && entry.attempts > 1 && (
                        <span>Attempts: {entry.attempts}</span>
                      )}
                    </div>

                    {entry.challengeFaced && (
                      <p className="text-[11px] text-purple-300/80 italic">
                        Obstacle: "{entry.challengeFaced}"
                      </p>
                    )}

                    {entry.notes && (
                      <p className="text-[11px] text-zinc-500">Note: {entry.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (prob) setActiveDebriefProblem(prob);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium transition-colors"
                    >
                      Update Debrief
                    </button>

                    {prob && (
                      <a
                        href={prob.leetcodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        title="Open on LeetCode"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center text-xs text-zinc-500 space-y-1">
            <p>No problem history logged yet.</p>
            <p className="text-[11px]">Solve a LeetCode problem to start your adaptive debrief record!</p>
          </div>
        )}
      </div>
    </div>
  );
}
