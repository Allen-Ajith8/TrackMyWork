import { NextRequest, NextResponse } from 'next/server';
import { executeCodeTests } from '@/lib/codetrack/code-runner';
import type { CodeLanguage, LeetCodeProblem, TestCase } from '@/types/codetrack';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, language, problem, testCases } = body as {
      code: string;
      language: CodeLanguage;
      problem: LeetCodeProblem;
      testCases: TestCase[];
    };

    if (!code || !language || !testCases) {
      return NextResponse.json(
        { error: 'Missing code, language, or testCases in request body' },
        { status: 400 }
      );
    }

    const testResults = await executeCodeTests(code, language, problem, testCases);
    const allPassed = testResults.every((tc) => tc.passed === true);

    return NextResponse.json({
      testResults,
      allPassed,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Execution error',
        details: error?.details || error?.stack || String(error),
      },
      { status: 500 }
    );
  }
}
