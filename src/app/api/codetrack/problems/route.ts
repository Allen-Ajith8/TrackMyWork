import { NextRequest, NextResponse } from 'next/server';
import { LEETCODE_PROBLEMS } from '@/lib/codetrack/data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get('topicId');
  const difficulty = searchParams.get('difficulty');

  let problems = LEETCODE_PROBLEMS;

  if (topicId) {
    problems = problems.filter((p) => p.topicId === topicId);
  }

  if (difficulty) {
    problems = problems.filter((p) => p.difficulty.toLowerCase() === difficulty.toLowerCase());
  }

  return NextResponse.json(problems);
}
