import { NextRequest, NextResponse } from 'next/server';
import { DSA_TOPICS, LEETCODE_PROBLEMS } from '@/lib/codetrack/data';
import type { DSALevel } from '@/types/codetrack';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const levelParam = searchParams.get('level') as DSALevel | null;

  let topics = DSA_TOPICS;
  if (levelParam && ['beginner', 'intermediate', 'advanced'].includes(levelParam)) {
    topics = DSA_TOPICS.filter((t) => t.level === levelParam);
  }

  // Attach problem counts
  const topicsWithCounts = topics.map((t) => {
    const topicProblems = LEETCODE_PROBLEMS.filter((p) => p.topicId === t.id);
    return {
      ...t,
      totalProblems: topicProblems.length,
      easyCount: topicProblems.filter((p) => p.difficulty === 'Easy').length,
      mediumCount: topicProblems.filter((p) => p.difficulty === 'Medium').length,
      hardCount: topicProblems.filter((p) => p.difficulty === 'Hard').length,
    };
  });

  return NextResponse.json(topicsWithCounts);
}
