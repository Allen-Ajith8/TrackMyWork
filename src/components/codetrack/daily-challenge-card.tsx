'use client';

import { useEffect, useState } from 'react';
import { useCodeTrackStore } from '@/lib/codetrack/store';
import type { OfficialDailyChallenge, LeetCodeProblem } from '@/types/codetrack';
import {
  Calendar,
  Sparkles,
  ExternalLink,
  CheckCircle,
  Clock,
  RefreshCw,
  Circle,
  Flame,
  Globe2,
  BookmarkCheck,
  Target,
  MessageSquare,
  Cpu,
} from 'lucide-react';

export function DailyChallengeCard() {
  const {
    level,
    preferredDifficulty,
    progressMap,
    setActiveDebriefProblem,
    setAgentProblem,
  } = useCodeTrackStore();

  const [officialDaily, setOfficialDaily] = useState<OfficialDailyChallenge | null>(null);
  const [personalizedPractice, setPersonalizedPractice] = useState<LeetCodeProblem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDaily() {
      try {
        const solvedList = Object.keys(progressMap).filter(
          (k) => progressMap[k]?.status === 'solved'
        );
        const res = await fetch(
          `/api/codetrack/daily-challenge?level=${level || 'beginner'}&preferredDiff=${preferredDifficulty}&solved=${solvedList.join(',')}`
        );
        if (res.ok) {
          const data = await res.json();
          setOfficialDaily(data.officialDaily);
          setPersonalizedPractice(data.personalizedPractice || []);
        }
      } catch (err) {
        console.warn('Daily challenge load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDaily();
  }, [level, preferredDifficulty, progressMap]);

  if (loading) {
    return (
      <div className="p-8 rounded-3xl bg-white dark:bg-[#0d121f]/90 border border-surface-200 dark:border-slate-800 animate-pulse h-48 flex flex-col items-center justify-center gap-2 text-xs text-surface-500 dark:text-slate-400 shadow-sm">
        <RefreshCw className="w-5 h-5 animate-spin text-primary-600 dark:text-purple-400" />
        <span>Fetching live official LeetCode Daily Challenge...</span>
      </div>
    );
  }

  const handleSolveOfficial = (challenge: OfficialDailyChallenge) => {
    window.open(challenge.url, '_blank', 'noopener,noreferrer');
    const mockProblem: LeetCodeProblem = {
      id: challenge.titleSlug,
      frontendQuestionId: challenge.frontendQuestionId,
      title: challenge.title,
      slug: challenge.titleSlug,
      difficulty: challenge.difficulty,
      leetcodeUrl: challenge.url,
      description: `Official LeetCode Daily Challenge for ${challenge.date}`,
      topicId: challenge.topicTags?.[0]?.toLowerCase().replace(/\s+/g, '-') || 'general',
      topicTags: challenge.topicTags || [],
      orderIndex: 0,
    };
    setTimeout(() => {
      setActiveDebriefProblem(mockProblem);
    }, 600);
  };

  const handleSolvePractice = (problem: LeetCodeProblem) => {
    window.open(problem.leetcodeUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => {
      setActiveDebriefProblem(problem);
    }, 600);
  };

  const officialStatus = officialDaily
    ? progressMap[officialDaily.titleSlug]?.status || 'unsolved'
    : 'unsolved';

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* SECTION A: OFFICIAL LIVE LEETCODE DAILY CHALLENGE                         */}
      {/* ========================================================================= */}
      {officialDaily && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50/70 via-white to-white border border-amber-200 p-6 sm:p-7 shadow-sm space-y-4">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar with Live Tag */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                <Globe2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-700 uppercase tracking-widest">
                    Official LeetCode Daily Coding Challenge
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-surface-600">
                  Synced directly from LeetCode for {officialDaily.date}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {officialDaily.acRate && (
                <span className="text-surface-600 font-mono text-[11px]">
                  Global Acceptance: <strong>{officialDaily.acRate}%</strong>
                </span>
              )}
            </div>
          </div>

          {/* Problem Info & Direct Action */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-surface-100 dark:bg-slate-800 border border-surface-200 dark:border-slate-700 font-mono text-xs font-bold text-surface-700 dark:text-slate-300">
                  #{officialDaily.frontendQuestionId}
                </span>
                <h4 className="text-xl font-bold text-surface-900 dark:text-white hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
                  {officialDaily.title}
                </h4>
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                    officialDaily.difficulty === 'Easy'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : officialDaily.difficulty === 'Medium'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-rose-50 text-rose-700 border-rose-300'
                  }`}
                >
                  {officialDaily.difficulty}
                </span>
              </div>

              {/* Tags */}
              {Array.isArray(officialDaily.topicTags) && officialDaily.topicTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {officialDaily.topicTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-surface-100 border border-surface-200 text-surface-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0">
              <div>
                {officialStatus === 'solved' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Completed Today
                  </span>
                ) : officialStatus === 'attempted' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300">
                    <Clock className="w-3.5 h-3.5" />
                    Attempted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-surface-100 text-surface-600 border border-surface-200">
                    <Circle className="w-3 h-3 text-surface-400" />
                    Unsolved
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const mockProblem: LeetCodeProblem = {
                      id: officialDaily.titleSlug,
                      frontendQuestionId: officialDaily.frontendQuestionId,
                      title: officialDaily.title,
                      slug: officialDaily.titleSlug,
                      difficulty: officialDaily.difficulty,
                      leetcodeUrl: officialDaily.url,
                      description: `Official LeetCode Daily Challenge for ${officialDaily.date}`,
                      topicId: officialDaily.topicTags?.[0]?.toLowerCase().replace(/\s+/g, '-') || 'general',
                      topicTags: officialDaily.topicTags || [],
                      orderIndex: 0,
                    };
                    setAgentProblem(mockProblem);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 transition-all hover:scale-[1.02] shadow-xs"
                >
                  <Cpu className="w-3.5 h-3.5 text-primary-600" />
                  <span>Solve with AI Agent</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSolveOfficial(officialDaily)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 shadow-md shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Solve on LeetCode</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: PERSONALIZED DAILY PRACTICE                                    */}
      {/* ========================================================================= */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#0d121f]/90 border border-surface-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-purple-400 flex items-center justify-center border border-primary-200 dark:border-primary-800/60">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-base font-bold text-surface-900 dark:text-white">
                Personalized Daily Practice
              </h4>
              <p className="text-xs text-surface-600 dark:text-slate-400">
                Tailored for your <span className="text-primary-700 dark:text-purple-300 font-semibold">{level}</span> track &amp; preferred <span className="text-primary-700 dark:text-purple-300 font-semibold">{preferredDifficulty}</span> difficulty
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {personalizedPractice.map((problem) => {
            const status = progressMap[problem.id]?.status || 'unsolved';

            return (
              <div
                key={problem.id}
                className="p-4 rounded-2xl bg-surface-50 dark:bg-slate-900/90 border border-surface-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-purple-600 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-surface-500 dark:text-slate-400">
                      #{problem.frontendQuestionId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        problem.difficulty === 'Easy'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
                          : problem.difficulty === 'Medium'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/60'
                      }`}
                    >
                      {problem.difficulty}
                    </span>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold text-surface-900 dark:text-white line-clamp-1">
                      {problem.title}
                    </h5>
                    <p className="text-[11px] text-surface-600 dark:text-slate-400 line-clamp-2 mt-1">
                      {problem.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-surface-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-surface-500 dark:text-slate-400 font-mono capitalize">
                    {status}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAgentProblem(problem)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-50 hover:bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:hover:bg-primary-900/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60 transition-colors shadow-xs"
                      title="Solve with AI Agent"
                    >
                      <Cpu className="w-3 h-3" />
                      <span>Agent</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSolvePractice(problem)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors shadow-xs"
                    >
                      <span>Solve</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
