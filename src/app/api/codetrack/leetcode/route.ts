import { NextRequest, NextResponse } from 'next/server';
import { fetchLeetCodeQuestion, formatLeetCodeTestCases } from '@/lib/codetrack/leetcode-api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug query parameter' }, { status: 400 });
    }

    const question = await fetchLeetCodeQuestion(slug);
    if (!question) {
      return NextResponse.json({ error: 'Problem not found on LeetCode' }, { status: 404 });
    }

    const testCases = formatLeetCodeTestCases(slug, question.exampleTestcaseList);

    return NextResponse.json({
      question,
      testCases,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch LeetCode data' }, { status: 500 });
  }
}
