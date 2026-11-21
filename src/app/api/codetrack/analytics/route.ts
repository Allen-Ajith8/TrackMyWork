import { NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { LEETCODE_PROBLEMS, DSA_TOPICS } from '@/lib/codetrack/data';
import type { CodeTrackAnalytics, Difficulty } from '@/types/codetrack';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerClientSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let progressRows: any[] = [];
    let profileRow: any = null;

    if (user) {
      const { data: pData } = await supabase
        .from('dsa_user_progress')
        .select('*')
        .eq('user_id', user.id);

      if (pData) progressRows = pData;

      const { data: prof } = await supabase
        .from('dsa_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (prof) profileRow = prof;
    }

    const totalProblems = LEETCODE_PROBLEMS.length;
    const solvedRows = progressRows.filter((r) => r.status === 'solved');
    const totalSolved = solvedRows.length;
    const easySolved = solvedRows.filter((r) => r.difficulty === 'Easy').length;
    const mediumSolved = solvedRows.filter((r) => r.difficulty === 'Medium').length;
    const hardSolved = solvedRows.filter((r) => r.difficulty === 'Hard').length;
    const totalAttempts = progressRows.reduce((acc, r) => acc + (r.attempts || 1), 0);
    const completionPercentage = totalProblems > 0 ? Math.round((totalSolved / totalProblems) * 100) : 0;

    const independentSolves = solvedRows.filter((r) => r.independence === 'independent').length;
    const assistedSolves = solvedRows.filter(
      (r) => r.independence === 'small_hint' || r.independence === 'substantial_help'
    ).length;

    // Topics needing improvement
    const topicsNeedingPractice = Array.from(
      new Set(
        progressRows
          .filter(
            (r) =>
              r.status === 'practice' ||
              r.confidence === 'low' ||
              r.independence === 'substantial_help'
          )
          .map((r) => r.topic_id)
      )
    ).slice(0, 5);

    // Topic progress
    const topicProgress = DSA_TOPICS.map((topic) => {
      const topicProblems = LEETCODE_PROBLEMS.filter(
        (p) =>
          p.topicId === topic.id ||
          p.topicTags.some((tag) => tag.toLowerCase().replace(/\s+/g, '-') === topic.id)
      );
      const solvedInTopic = topicProblems.filter((p) =>
        progressRows.some((r) => r.problem_id === p.id && r.status === 'solved')
      ).length;
      const attemptedInTopic = topicProblems.filter((p) =>
        progressRows.some(
          (r) => r.problem_id === p.id && (r.status === 'attempted' || r.status === 'practice')
        )
      ).length;

      return {
        topicId: topic.id,
        topicName: topic.name,
        category: topic.category,
        level: topic.level,
        total: topicProblems.length,
        solved: solvedInTopic,
        attempted: attemptedInTopic,
        percentage:
          topicProblems.length > 0 ? Math.round((solvedInTopic / topicProblems.length) * 100) : 0,
      };
    });

    // Weekly activity (last 7 days)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weeklyActivity = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = days[d.getDay()];

      const solvedOnDay = progressRows.filter(
        (r) => r.solved_at && r.solved_at.startsWith(dateStr) && r.status === 'solved'
      ).length;

      const attemptedOnDay = progressRows.filter(
        (r) => r.last_attempted_at && r.last_attempted_at.startsWith(dateStr)
      ).length;

      weeklyActivity.push({
        day: dayName,
        date: dateStr,
        solvedCount: solvedOnDay,
        attemptCount: attemptedOnDay,
      });
    }

    // Recent solved
    const recentSolved = solvedRows
      .sort((a, b) => new Date(b.solved_at || 0).getTime() - new Date(a.solved_at || 0).getTime())
      .slice(0, 10)
      .map((r) => {
        const prob = LEETCODE_PROBLEMS.find((p) => p.id === r.problem_id);
        return {
          problemId: r.problem_id,
          frontendQuestionId: prob?.frontendQuestionId || '',
          title: prob ? prob.title : r.problem_id,
          difficulty: (r.difficulty || prob?.difficulty || 'Easy') as Difficulty,
          topicId: r.topic_id,
          solvedAt: r.solved_at || new Date().toISOString(),
          leetcodeUrl: prob ? prob.leetcodeUrl : `https://leetcode.com/problems/${r.problem_id}/`,
          independence: r.independence,
        };
      });

    const analytics: CodeTrackAnalytics = {
      totalProblems,
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      totalAttempts,
      currentStreak: profileRow?.streak || 1,
      completionPercentage,
      independentSolves,
      assistedSolves,
      topicsNeedingPractice,
      topicProgress,
      weeklyActivity,
      recentSolved,
    };

    return NextResponse.json(analytics);
  } catch {
    return NextResponse.json({
      totalProblems: LEETCODE_PROBLEMS.length,
      totalSolved: 0,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0,
      totalAttempts: 0,
      currentStreak: 1,
      completionPercentage: 0,
      independentSolves: 0,
      assistedSolves: 0,
      topicsNeedingPractice: [],
      topicProgress: [],
      weeklyActivity: [],
      recentSolved: [],
    });
  }
}
