'use client';

import { useCodeTrackStore } from '@/lib/codetrack/store';
import { LEETCODE_PROBLEMS, DSA_TOPICS } from '@/lib/codetrack/data';
import type { Difficulty } from '@/types/codetrack';
import {
  Trophy,
  Flame,
  CheckCircle2,
  Clock,
  Target,
  BarChart3,
  ExternalLink,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export function AnalyticsDashboard() {
  const { progressMap, streak } = useCodeTrackStore();

  const totalProblems = LEETCODE_PROBLEMS.length;
  const progressEntries = Object.values(progressMap);

  const solvedEntries = progressEntries.filter((p) => p.status === 'solved');
  const totalSolved = solvedEntries.length;
  const easySolved = solvedEntries.filter((p) => p.difficulty === 'Easy').length;
  const mediumSolved = solvedEntries.filter((p) => p.difficulty === 'Medium').length;
  const hardSolved = solvedEntries.filter((p) => p.difficulty === 'Hard').length;

  const totalAttempts = progressEntries.reduce((acc, p) => acc + (p.attempts || 1), 0);
  const completionPercentage = totalProblems > 0 ? Math.round((totalSolved / totalProblems) * 100) : 0;

  // Breakdown chart data
  const difficultyData = [
    { name: 'Easy', count: easySolved, fill: '#10b981' },
    { name: 'Medium', count: mediumSolved, fill: '#f59e0b' },
    { name: 'Hard', count: hardSolved, fill: '#f43f5e' },
  ];

  // Past 7 days activity
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const weeklyData = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = days[d.getDay()];

    const solvedOnDay = solvedEntries.filter(
      (p) => p.solvedAt && p.solvedAt.startsWith(dateStr)
    ).length;

    const attemptedOnDay = progressEntries.filter(
      (p) => p.lastAttemptedAt && p.lastAttemptedAt.startsWith(dateStr)
    ).length;

    weeklyData.push({
      day: dayName,
      date: dateStr,
      solved: solvedOnDay,
      attempts: attemptedOnDay,
    });
  }

  // Recent solved list
  const recentSolved = [...solvedEntries]
    .sort((a, b) => new Date(b.solvedAt || 0).getTime() - new Date(a.solvedAt || 0).getTime())
    .slice(0, 8)
    .map((p) => {
      const prob = LEETCODE_PROBLEMS.find((lp) => lp.id === p.problemId);
      return {
        ...p,
        title: prob ? prob.title : p.problemId,
        leetcodeUrl: prob ? prob.leetcodeUrl : `https://leetcode.com/problems/${p.problemId}/`,
      };
    });

  return (
    <div className="space-y-6">
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Solved */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Solved</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">{totalSolved}</span>
            <span className="text-xs text-zinc-500 font-mono">/ {totalProblems}</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Current Streak */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Current Streak</span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">{streak}</span>
            <span className="text-xs text-zinc-400 font-medium">days active</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">Keep momentum rolling!</p>
        </div>

        {/* Total Attempts */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Attempts</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">{totalAttempts}</span>
            <span className="text-xs text-zinc-400 font-medium">logged runs</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">Real practice history</p>
        </div>

        {/* Overall Completion */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">DSA Mastery</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              {completionPercentage}%
            </span>
            <span className="text-xs text-zinc-400 font-medium">curriculum done</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Difficulty Breakdown & Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Difficulty Distribution */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-white">Difficulty Breakdown</h4>
              <p className="text-xs text-zinc-400">Distribution of problems solved</p>
            </div>
            <BarChart3 className="w-5 h-5 text-zinc-500" />
          </div>

          <div className="h-48 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={difficultyData}>
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {difficultyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-900 text-center">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] text-emerald-400 font-semibold block">Easy</span>
              <span className="text-lg font-bold text-white">{easySolved}</span>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[11px] text-amber-400 font-semibold block">Medium</span>
              <span className="text-lg font-bold text-white">{mediumSolved}</span>
            </div>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <span className="text-[11px] text-rose-400 font-semibold block">Hard</span>
              <span className="text-lg font-bold text-white">{hardSolved}</span>
            </div>
          </div>
        </div>

        {/* Weekly Activity Chart */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-white">Weekly Activity</h4>
              <p className="text-xs text-zinc-400">Problems solved & attempts over the last 7 days</p>
            </div>
            <Calendar className="w-5 h-5 text-zinc-500" />
          </div>

          <div className="h-48 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis dataKey="day" stroke="#71717a" fontSize={12} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="solved" fill="#8b5cf6" name="Solved" radius={[4, 4, 0, 0]} />
                <Bar dataKey="attempts" fill="#3b82f6" name="Attempts" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 pt-2 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-purple-500" />
              <span>Problems Solved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>Practice Attempts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Topic-Wise Progress Table / Bars */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-bold text-white">Topic Mastery Matrix</h4>
            <p className="text-xs text-zinc-400">Detailed completion breakdown across all curriculum concepts</p>
          </div>
          <Layers className="w-5 h-5 text-zinc-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
          {DSA_TOPICS.map((topic) => {
            const topicProblems = LEETCODE_PROBLEMS.filter((p) => p.topicId === topic.id);
            const solvedCount = topicProblems.filter(
              (p) => progressMap[p.id]?.status === 'solved'
            ).length;
            const pct = topicProblems.length > 0 ? Math.round((solvedCount / topicProblems.length) * 100) : 0;

            return (
              <div
                key={topic.id}
                className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{topic.name}</span>
                  <span className="font-mono text-zinc-400">
                    {solvedCount}/{topicProblems.length} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Solved Problems Feed */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-bold text-white">Recent Solved Problems</h4>
            <p className="text-xs text-zinc-400">Your latest logged victories on LeetCode</p>
          </div>
          <Target className="w-5 h-5 text-zinc-500" />
        </div>

        {recentSolved.length > 0 ? (
          <div className="divide-y divide-zinc-900">
            {recentSolved.map((item, idx) => (
              <div
                key={idx}
                className="py-3 flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">{item.title}</span>
                    <span className="text-zinc-500 ml-2 font-mono">
                      {new Date(item.solvedAt || '').toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      item.difficulty === 'Easy'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : item.difficulty === 'Medium'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {item.difficulty}
                  </span>

                  <a
                    href={item.leetcodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-white p-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-zinc-500">
            No problems marked as solved yet. Complete your first challenge above!
          </div>
        )}
      </div>
    </div>
  );
}
