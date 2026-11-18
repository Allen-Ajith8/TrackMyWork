'use client';

import { useState, useMemo } from 'react';
import { useCodeTrackStore } from '@/lib/codetrack/store';
import { getProblemsByTopic, getTopicById } from '@/lib/codetrack/data';
import type { LeetCodeProblem, Difficulty } from '@/types/codetrack';
import {
  ExternalLink,
  CheckCircle,
  Clock,
  RefreshCw,
  Circle,
  Sparkles,
  HelpCircle,
  ChevronDown,
  Filter,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Cpu,
} from 'lucide-react';

interface ProblemListProps {
  topicId: string;
}

const PROBLEMS_PER_PAGE = 8;

export function ProblemList({ topicId }: ProblemListProps) {
  const { progressMap, setActiveDebriefProblem, setAgentProblem } = useCodeTrackStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'number' | 'difficulty' | 'acceptance'>('number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});

  const topic = getTopicById(topicId);
  const allProblems = useMemo(() => getProblemsByTopic(topicId), [topicId]);

  // Filter and Sort
  const processedProblems = useMemo(() => {
    let result = allProblems.filter((p) => {
      // Search
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.frontendQuestionId.includes(searchQuery) ||
        (Array.isArray(p.topicTags) && p.topicTags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())));

      if (!matchesSearch) return false;

      // Difficulty
      if (filterDifficulty !== 'all' && p.difficulty.toLowerCase() !== filterDifficulty.toLowerCase()) {
        return false;
      }

      // Status
      const status = progressMap[p.id]?.status || 'unsolved';
      if (filterStatus === 'solved' && status !== 'solved') return false;
      if (filterStatus === 'attempted' && status !== 'attempted') return false;
      if (filterStatus === 'practice' && status !== 'practice') return false;
      if (filterStatus === 'unsolved' && status !== 'unsolved') return false;

      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'number') {
        const numA = parseInt(a.frontendQuestionId, 10) || 0;
        const numB = parseInt(b.frontendQuestionId, 10) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }

      if (sortBy === 'difficulty') {
        const order = { Easy: 1, Medium: 2, Hard: 3 };
        const diffA = order[a.difficulty] || 0;
        const diffB = order[b.difficulty] || 0;
        return sortOrder === 'asc' ? diffA - diffB : diffB - diffA;
      }

      if (sortBy === 'acceptance') {
        const rateA = parseFloat(a.acceptance?.replace('%', '') || '0');
        const rateB = parseFloat(b.acceptance?.replace('%', '') || '0');
        return sortOrder === 'asc' ? rateA - rateB : rateB - rateA;
      }

      return 0;
    });

    return result;
  }, [allProblems, searchQuery, filterDifficulty, filterStatus, sortBy, sortOrder, progressMap]);

  // Pagination
  const totalPages = Math.ceil(processedProblems.length / PROBLEMS_PER_PAGE) || 1;
  const paginatedProblems = useMemo(() => {
    const start = (currentPage - 1) * PROBLEMS_PER_PAGE;
    return processedProblems.slice(start, start + PROBLEMS_PER_PAGE);
  }, [processedProblems, currentPage]);

  const handleSolveOnLeetCode = (problem: LeetCodeProblem) => {
    window.open(problem.leetcodeUrl, '_blank', 'noopener,noreferrer');
    // Prompt with debrief modal
    setTimeout(() => {
      setActiveDebriefProblem(problem);
    }, 600);
  };

  const toggleHint = (problemId: string) => {
    setExpandedHints((prev) => ({
      ...prev,
      [problemId]: !prev[problemId],
    }));
  };

  const getStatusBadge = (problem: LeetCodeProblem) => {
    const progress = progressMap[problem.id];
    const status = progress?.status || 'unsolved';

    switch (status) {
      case 'solved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3.5 h-3.5" />
            Solved
          </span>
        );
      case 'attempted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            Attempted
          </span>
        );
      case 'practice':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <RefreshCw className="w-3.5 h-3.5" />
            Need Practice
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-100 text-surface-600 border border-surface-200">
            <Circle className="w-3 h-3 text-surface-400" />
            Not Started
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Bar: Search, Filters, Sorting */}
      <div className="p-5 rounded-3xl bg-white border border-surface-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-primary-700 uppercase tracking-wider">
                LeetCode Problem Library
              </span>
              <span className="text-surface-400">•</span>
              <span className="text-xs text-surface-500 font-semibold">{topic?.name}</span>
            </div>
            <h3 className="text-xl font-extrabold text-surface-900 mt-0.5">
              {topic?.name} ({processedProblems.length} available)
            </h3>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search problem title, #, tag..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-surface-50 border border-surface-200 text-surface-900 placeholder:text-surface-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 shadow-xs"
            />
          </div>
        </div>

        {/* Filter & Sort Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-surface-100 text-xs">
          {/* Difficulty Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-surface-500 font-mono text-[11px] mr-1">Diff:</span>
            {['all', 'easy', 'medium', 'hard'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setFilterDifficulty(d);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg capitalize transition-all ${
                  filterDifficulty === d
                    ? 'bg-primary-600 text-white font-bold shadow-xs'
                    : 'bg-surface-50 text-surface-600 hover:text-surface-900 border border-surface-200 hover:bg-surface-100'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-surface-500 font-mono text-[11px] mr-1">Status:</span>
            {['all', 'unsolved', 'solved', 'attempted'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setFilterStatus(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg capitalize transition-all ${
                  filterStatus === st
                    ? 'bg-primary-600 text-white font-bold shadow-xs'
                    : 'bg-surface-50 text-surface-600 hover:text-surface-900 border border-surface-200 hover:bg-surface-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-surface-500 font-mono text-[11px] mr-1 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 rounded-lg bg-surface-50 border border-surface-200 text-surface-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="number">Problem #</option>
              <option value="difficulty">Difficulty</option>
              <option value="acceptance">Acceptance %</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="px-2 py-1 rounded-lg bg-surface-50 border border-surface-200 text-surface-600 hover:text-surface-900 font-mono"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* Problems List */}
      <div className="grid grid-cols-1 gap-3.5">
        {paginatedProblems.map((problem) => {
          const progress = progressMap[problem.id];
          const isHintOpen = expandedHints[problem.id] || false;

          return (
            <div
              key={problem.id}
              className="p-5 rounded-2xl bg-white border border-surface-200 hover:border-surface-300 transition-all space-y-3 shadow-xs"
            >
              {/* Header row */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-surface-100 border border-surface-200 font-mono text-xs font-bold text-surface-700">
                      #{problem.frontendQuestionId}
                    </span>
                    <h4 className="text-base font-bold text-surface-900 hover:text-primary-600 transition-colors">
                      {problem.title}
                    </h4>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                        problem.difficulty === 'Easy'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : problem.difficulty === 'Medium'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {problem.difficulty}
                    </span>
                    {problem.acceptance && (
                      <span className="text-xs text-surface-500 font-mono">
                        Acc: {problem.acceptance}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-surface-600 leading-relaxed max-w-3xl">
                    {problem.description}
                  </p>

                  {/* Topic Tags */}
                  {Array.isArray(problem.topicTags) && problem.topicTags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {problem.topicTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-50 border border-surface-200 text-surface-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
                  {getStatusBadge(problem)}

                  {/* Solve with AI Agent button */}
                  <button
                    type="button"
                    onClick={() => setAgentProblem(problem)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl transition-all shadow-xs"
                    title="Open in AI Coding Agent studio"
                  >
                    <Cpu className="w-3.5 h-3.5 text-primary-600" />
                    <span>Agent</span>
                  </button>

                  {/* Debrief button */}
                  <button
                    type="button"
                    onClick={() => setActiveDebriefProblem(problem)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-surface-700 hover:text-surface-900 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-xl transition-all shadow-xs"
                    title="Conduct adaptive post-problem debrief with AI mentor"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-primary-600" />
                    <span>{progress?.status ? 'Re-Debrief' : 'Debrief'}</span>
                  </button>

                  {/* Solve on LeetCode button */}
                  <button
                    type="button"
                    onClick={() => handleSolveOnLeetCode(problem)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Solve on LeetCode</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Hints and attempts footer */}
              <div className="pt-2 border-t border-surface-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  {problem.hints && problem.hints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleHint(problem.id)}
                      className="inline-flex items-center gap-1 text-surface-500 hover:text-primary-600 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{isHintOpen ? 'Hide Hints' : 'Show Hints'}</span>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${isHintOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}

                  {progress?.challengeFaced && (
                    <span className="text-surface-500 italic truncate max-w-md hidden sm:inline">
                      Hurdle: {progress.challengeFaced}
                    </span>
                  )}
                </div>

                {progress?.attempts && progress.attempts > 1 && (
                  <span className="text-[11px] text-surface-500 font-mono">
                    {progress.attempts} attempts logged
                  </span>
                )}
              </div>

              {/* Hints Box */}
              {isHintOpen && problem.hints && (
                <div className="p-4 rounded-xl bg-primary-50/60 border border-primary-200 text-xs text-primary-950 space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 font-bold text-primary-800">
                    <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                    <span>Algorithmic Clues:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-surface-700 leading-relaxed">
                    {problem.hints.map((hint, i) => (
                      <li key={i}>{hint}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}

        {processedProblems.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-white border border-surface-200 text-surface-500 text-xs space-y-2 shadow-xs">
            <p>No problems match the selected filter criteria.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterDifficulty('all');
                setFilterStatus('all');
              }}
              className="text-primary-600 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="p-4 rounded-2xl bg-white border border-surface-200 shadow-xs flex items-center justify-between text-xs">
          <span className="text-surface-500 font-mono">
            Page {currentPage} of {totalPages} ({processedProblems.length} total)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl bg-surface-50 border border-surface-200 text-surface-600 hover:text-surface-900 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              if (
                pNum === 1 ||
                pNum === totalPages ||
                (pNum >= currentPage - 1 && pNum <= currentPage + 1)
              ) {
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setCurrentPage(pNum)}
                    className={`w-8 h-8 rounded-xl font-mono text-xs font-semibold transition-all ${
                      currentPage === pNum
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'bg-surface-50 border border-surface-200 text-surface-600 hover:text-surface-900'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              }
              if (pNum === currentPage - 2 || pNum === currentPage + 2) {
                return (
                  <span key={pNum} className="text-surface-400 font-mono">
                    ...
                  </span>
                );
              }
              return null;
            })}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl bg-surface-50 border border-surface-200 text-surface-600 hover:text-surface-900 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
