'use client';

import React, { useState, useMemo } from 'react';
import { Folder } from '@/components/ui/folder';
import { getProblemsByTopic } from '@/lib/codetrack/data';
import { useCodeTrackStore } from '@/lib/codetrack/store';
import type { DSATopic, LeetCodeProblem } from '@/types/codetrack';
import {
  X,
  Sparkles,
  ExternalLink,
  Cpu,
  MessageSquare,
  Layers,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  FolderOpen,
  Eye,
  ArrowRight,
  Maximize2
} from 'lucide-react';

export const TOPIC_COLORS: Record<string, string> = {
  arrays: '#8b5cf6',
  strings: '#10b981',
  'hash-tables': '#06b6d4',
  'linked-lists': '#f59e0b',
  stack: '#ec4899',
  queue: '#6366f1',
  'binary-trees': '#14b8a6',
  'binary-search-trees': '#7c3aed',
  'heaps-priority-queue': '#f97316',
  matrix: '#2563eb',
  'two-pointers': '#059669',
  'sliding-window': '#d946ef',
  'prefix-sum': '#3b82f6',
  'difference-array': '#e11d48',
  'binary-search': '#0ea5e9',
};

interface TopicFolderVaultProps {
  topic: DSATopic;
  isOpen: boolean;
  onClose: () => void;
  onSelectProblem?: (problem: LeetCodeProblem) => void;
}

export function TopicFolderVaultModal({
  topic,
  isOpen,
  onClose,
  onSelectProblem,
}: TopicFolderVaultProps) {
  const { setAgentProblem, setActiveDebriefProblem, setActiveTab, progressMap } = useCodeTrackStore();
  const [selectedProblem, setSelectedProblem] = useState<LeetCodeProblem | null>(null);
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState<'spread' | 'row' | 'stack'>('spread');
  const [folderOpen, setFolderOpen] = useState(true);

  const allProblems = useMemo(() => getProblemsByTopic(topic.id), [topic.id]);
  const pageSize = 6;
  const totalPages = Math.ceil(allProblems.length / pageSize) || 1;
  const currentBatch = useMemo(
    () => allProblems.slice(page * pageSize, (page + 1) * pageSize),
    [allProblems, page, pageSize]
  );

  const topicColor = TOPIC_COLORS[topic.id] || '#8b5cf6';

  if (!isOpen) return null;

  const handleOpenInAgent = (p: LeetCodeProblem) => {
    setAgentProblem(p);
    setActiveTab('agent');
    onClose();
  };

  const handleOpenDebrief = (p: LeetCodeProblem) => {
    setActiveDebriefProblem(p);
    onClose();
  };

  const handleScrollToProblem = (p: LeetCodeProblem) => {
    onClose();
    if (onSelectProblem) {
      onSelectProblem(p);
    }
    setTimeout(() => {
      const el = document.getElementById(`problem-${p.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-primary-500', 'transition-all');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-primary-500');
        }, 2000);
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface-950/75 backdrop-blur-md animate-in fade-in-50 duration-200">
      <div className="relative w-full max-w-5xl xl:max-w-6xl bg-white dark:bg-[#0d121f] rounded-3xl border border-surface-200/80 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200/70 dark:border-slate-800 bg-surface-50/80 dark:bg-[#0d121f]">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: topicColor }}
            >
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-surface-500 dark:text-slate-400">
                  Interactive 3D Concept Vault
                </span>
                <span className="text-surface-300 dark:text-slate-600">•</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 dark:bg-primary-950/40 dark:text-primary-300 dark:border-primary-800/60">
                  {allProblems.length} Sums Inside
                </span>
              </div>
              <h3 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>{topic.name}</span>
                <span className="text-xs font-normal text-surface-500 dark:text-slate-400 hidden sm:inline">
                  (Touch any sum card to jump into it)
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Folder Layout switcher */}
            <div className="hidden sm:flex items-center gap-1 bg-surface-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
              {(['spread', 'row', 'stack'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayout(l)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    layout === l
                      ? 'bg-white dark:bg-slate-700 text-surface-900 dark:text-white font-bold shadow-xs'
                      : 'text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-2.5 text-surface-400 dark:text-slate-400 hover:text-surface-700 dark:hover:text-white hover:bg-surface-200/50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Close Vault"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3D Folder Interactive Arena */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex flex-col items-center justify-center min-h-[520px] sm:min-h-[580px] bg-gradient-to-b from-surface-50/50 via-white to-surface-50/30 dark:from-[#0b0f19] dark:via-[#0d121f] dark:to-[#0b0f19]">
          <div className="text-center mb-2">
            <p className="text-xs sm:text-sm text-surface-600 dark:text-slate-400 font-medium flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Tap the folder flap to open or close • Touch any sum card inside to inspect &amp; solve</span>
            </p>
          </div>

          {/* 3D Folder Element (Enlarged) */}
          <div className="my-4 py-6 flex items-center justify-center select-none w-full">
            <Folder
              label={topic.name}
              color={topicColor}
              size={1.75}
              mode="flap"
              variant="solid"
              layout={layout}
              open={folderOpen}
              onOpenChange={setFolderOpen}
              onItemClick={(item: any, index: number) => {
                const problem = currentBatch[index];
                if (problem) {
                  setSelectedProblem(problem);
                }
              }}
            >
              {currentBatch.map((p) => {
                const isSolved = progressMap[p.id]?.status === 'solved';
                const diffColor =
                  p.difficulty === 'Easy'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                    : p.difficulty === 'Medium'
                    ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                    : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60';

                return (
                  <div
                    key={p.id}
                    className="h-full w-full p-4 flex flex-col justify-between bg-white dark:bg-slate-900 rounded-xl shadow-md border border-surface-200/90 dark:border-slate-700 hover:border-primary-500 dark:hover:border-purple-500 cursor-pointer transition-all select-none group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="font-mono text-xs font-bold text-surface-500 dark:text-slate-400">
                          #{p.frontendQuestionId}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${diffColor}`}>
                          {p.difficulty}
                        </span>
                      </div>
                      <h5 className="font-extrabold text-sm sm:text-base text-surface-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-purple-400 transition-colors">
                        {p.title}
                      </h5>
                      {p.description && (
                        <p className="text-[11px] text-surface-500 dark:text-slate-400 line-clamp-3 leading-relaxed mt-1.5">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-surface-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        {isSolved ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Solved
                          </span>
                        ) : (
                          <span className="text-surface-500 dark:text-slate-400 font-mono font-medium">
                            {p.acceptance || 'LeetCode'}
                          </span>
                        )}
                      </div>
                      <span className="text-primary-600 dark:text-purple-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                        Solve →
                      </span>
                    </div>
                  </div>
                );
              })}
            </Folder>
          </div>

          {/* Pagination for sums if total > 6 */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-surface-200/60 dark:border-slate-800">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-surface-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-surface-200 dark:border-slate-700 hover:bg-surface-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev Sums</span>
              </button>

              <span className="text-xs font-mono font-semibold text-surface-600 dark:text-slate-400 px-2">
                Batch {page + 1} of {totalPages} ({page * pageSize + 1} -{' '}
                {Math.min(allProblems.length, (page + 1) * pageSize)} of {allProblems.length})
              </span>

              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-surface-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-surface-200 dark:border-slate-700 hover:bg-surface-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all"
              >
                <span>Next Sums</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Selected Sum Action Sheet (Shows up immediately when user touches a sum) */}
        {selectedProblem && (
          <div className="p-5 border-t border-surface-200 dark:border-slate-800 bg-primary-50/40 dark:bg-purple-950/30 animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary-700 dark:text-purple-300">
                    #{selectedProblem.frontendQuestionId}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedProblem.difficulty === 'Easy'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : selectedProblem.difficulty === 'Medium'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    {selectedProblem.difficulty}
                  </span>
                  <span className="text-xs font-mono text-surface-500 dark:text-slate-400">
                    Acceptance: {selectedProblem.acceptance}
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-surface-900 dark:text-white">
                  {selectedProblem.title}
                </h4>
                <p className="text-xs text-surface-600 dark:text-slate-300 line-clamp-2 max-w-2xl leading-relaxed">
                  {selectedProblem.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* 1. Solve in AI Coding Agent */}
                <button
                  onClick={() => handleOpenInAgent(selectedProblem)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-all hover:scale-105 active:scale-95"
                  title="Open in AI Coding Agent IDE"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Solve with AI Agent</span>
                </button>

                {/* 2. Debrief with AI Mentor */}
                <button
                  onClick={() => handleOpenDebrief(selectedProblem)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-surface-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-surface-50 dark:hover:bg-slate-700 border border-surface-200 dark:border-slate-700 shadow-xs transition-all"
                  title="Debrief with AI Mentor"
                >
                  <MessageSquare className="w-4 h-4 text-primary-600 dark:text-purple-400" />
                  <span>Debrief</span>
                </button>

                {/* 3. Open on LeetCode */}
                {selectedProblem.leetcodeUrl && (
                  <a
                    href={selectedProblem.leetcodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-xs transition-all"
                  >
                    <span>LeetCode</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {/* 4. Scroll to in problem list */}
                <button
                  onClick={() => handleScrollToProblem(selectedProblem)}
                  className="p-2 text-surface-500 dark:text-slate-400 hover:text-surface-800 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-surface-100 dark:hover:bg-slate-700 border border-surface-200 dark:border-slate-700 rounded-xl transition-colors"
                  title="View in full problem library below"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Embedded Showcase Vault Banner that sits above the ProblemList
 * giving immediate 3D tactile interaction on the topic page!
 */
export function TopicFolderVaultBanner({
  topic,
  onOpenModal,
}: {
  topic: DSATopic;
  onOpenModal: () => void;
}) {
  const { setAgentProblem, setActiveTab, progressMap } = useCodeTrackStore();
  const allProblems = useMemo(() => getProblemsByTopic(topic.id), [topic.id]);
  const currentBatch = useMemo(() => allProblems.slice(0, 6), [allProblems]);
  const topicColor = TOPIC_COLORS[topic.id] || '#8b5cf6';
  const [folderOpen, setFolderOpen] = useState(true);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-surface-200/80 dark:border-slate-800 bg-gradient-to-r from-surface-50 via-white to-surface-50/60 dark:from-[#0b0f19] dark:via-[#0d121f] dark:to-[#0b0f19] p-6 shadow-xs transition-all">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Left Information */}
        <div className="space-y-3 max-w-sm text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary-100 text-primary-800 border border-primary-200 dark:bg-primary-950/40 dark:text-primary-300 dark:border-primary-800/60">
            <Sparkles className="w-3.5 h-3.5 text-primary-600 dark:text-purple-400" />
            <span>Interactive 3D {topic.name} Box</span>
          </div>

          <h3 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">
            {topic.name} Problem Vault
          </h3>

          <p className="text-xs text-surface-600 dark:text-slate-400 leading-relaxed">
            Touch and open the physical 3D folder below. Each card is a curated LeetCode sum. Touch any sum to open its description, solution hints, and AI coding studio.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-2">
            <button
              onClick={onOpenModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Expand 3D Vault</span>
            </button>

            <button
              onClick={() => setFolderOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-surface-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-surface-100 dark:hover:bg-slate-700 border border-surface-200 dark:border-slate-700 shadow-xs transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5 text-primary-600 dark:text-purple-400" />
              <span>{folderOpen ? 'Close Flap' : 'Open Flap'}</span>
            </button>
          </div>
        </div>

        {/* Right: The Interactive 3D Folder */}
        <div className="flex items-center justify-center p-3 select-none">
          <Folder
            label={topic.name}
            color={topicColor}
            size={0.95}
            mode="flap"
            variant="solid"
            layout="spread"
            open={folderOpen}
            onOpenChange={setFolderOpen}
            onItemClick={(item: any, index: number) => {
              const problem = currentBatch[index];
              if (problem) {
                setAgentProblem(problem);
                setActiveTab('agent');
              }
            }}
          >
            {currentBatch.map((p) => {
              const isSolved = progressMap[p.id]?.status === 'solved';
              const diffColor =
                p.difficulty === 'Easy'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                  : p.difficulty === 'Medium'
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                  : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60';

              return (
                <div
                  key={p.id}
                  className="h-full w-full p-2 flex flex-col justify-between bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-surface-200/90 dark:border-slate-700 hover:border-primary-500 dark:hover:border-purple-500 cursor-pointer transition-all select-none group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-[9px] font-bold text-surface-500 dark:text-slate-400">
                        #{p.frontendQuestionId}
                      </span>
                      <span className={`px-1 py-0.2 rounded text-[8px] font-bold uppercase border ${diffColor}`}>
                        {p.difficulty}
                      </span>
                    </div>
                    <h5 className="font-bold text-[10px] text-surface-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-purple-400 transition-colors">
                      {p.title}
                    </h5>
                  </div>

                  <div className="mt-1 pt-1 border-t border-surface-100 dark:border-slate-800 flex items-center justify-between text-[8px]">
                    <span className="text-surface-400 dark:text-slate-500 font-mono">
                      {isSolved ? 'Solved ✓' : p.acceptance || 'LeetCode'}
                    </span>
                    <span className="text-primary-600 dark:text-purple-400 font-bold group-hover:underline">
                      Solve →
                    </span>
                  </div>
                </div>
              );
            })}
          </Folder>
        </div>
      </div>
    </div>
  );
}
