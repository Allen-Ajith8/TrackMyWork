import { NextRequest, NextResponse } from 'next/server';
import { fetchLiveLeetCodeDailyChallenge } from '@/lib/codetrack/daily';
import { LEETCODE_PROBLEMS } from '@/lib/codetrack/data';
import type { DSALevel, Difficulty, PreferredDifficulty } from '@/types/codetrack';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const level = (searchParams.get('level') as DSALevel) || 'beginner';
    const preferredDiff = (searchParams.get('preferredDiff') as PreferredDifficulty) || 'Mixed Practice';
    const solvedList = searchParams.get('solved')?.split(',').filter(Boolean) || [];

    // 1. Fetch the EXACT Official LeetCode Daily Challenge
    const officialDaily = await fetchLiveLeetCodeDailyChallenge();

    // 2. Select 2-3 Personalized Daily Practice Problems (Separate section)
    let candidatePool = LEETCODE_PROBLEMS.filter((p) => !solvedList.includes(p.id));

    if (preferredDiff === 'Easy') {
      const easyPool = candidatePool.filter((p) => p.difficulty === 'Easy');
      if (easyPool.length > 0) candidatePool = easyPool;
    } else if (preferredDiff === 'Medium') {
      const medPool = candidatePool.filter((p) => p.difficulty === 'Medium');
      if (medPool.length > 0) candidatePool = medPool;
    } else if (preferredDiff === 'Hard') {
      const hardPool = candidatePool.filter((p) => p.difficulty === 'Hard');
      if (hardPool.length > 0) candidatePool = hardPool;
    } else {
      // Mixed Practice based on level
      if (level === 'beginner') {
        candidatePool = candidatePool.filter((p) => p.difficulty === 'Easy' || p.difficulty === 'Medium');
      } else if (level === 'intermediate') {
        candidatePool = candidatePool.filter((p) => p.difficulty === 'Medium' || p.difficulty === 'Easy');
      } else {
        candidatePool = candidatePool.filter((p) => p.difficulty === 'Medium' || p.difficulty === 'Hard');
      }
    }

    // Pick 3 deterministic problems for today
    const todayStr = new Date().toISOString().split('T')[0];
    let seed = 0;
    for (let i = 0; i < todayStr.length; i++) {
      seed = (seed * 31 + todayStr.charCodeAt(i)) % 1000000;
    }

    const personalizedPractice = [];
    const pool = candidatePool.length > 0 ? candidatePool : LEETCODE_PROBLEMS;
    const countToPick = Math.min(3, pool.length);

    for (let i = 0; i < countToPick; i++) {
      const idx = (seed + i * 7) % pool.length;
      personalizedPractice.push(pool[idx]);
    }

    return NextResponse.json({
      officialDaily,
      personalizedPractice,
      date: officialDaily?.date || todayStr,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Failed to retrieve daily challenges',
        message: err.message,
      },
      { status: 500 }
    );
  }
}
