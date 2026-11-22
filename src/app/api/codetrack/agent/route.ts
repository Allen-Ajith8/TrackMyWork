import { NextRequest, NextResponse } from 'next/server';
import { LEETCODE_PROBLEMS } from '@/lib/codetrack/data';
import {
  generateDeterministicSolution,
  generateAgentHint,
  getProblemHints,
  generateNextLineGuidance,
  analyzeAndDebugCode,
  diagnoseTestFailure,
  getProblemTestCases,
} from '@/lib/codetrack/agent';
import { executeCodeTests, resolveEffectiveLanguage } from '@/lib/codetrack/code-runner';
import { runLangGraphCodingAgent } from '@/lib/codetrack/langgraph-agent';
import { repairStrandedCode } from '@/lib/codetrack/indentation';
import type { CodeLanguage, LeetCodeProblem, TestCase } from '@/types/codetrack';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      problemId,
      problem: passedProblem,
      language = 'python',
      userCode = '',
      hintIndex = 0,
      testCases = [],
    }: {
      action: 'solve' | 'hint' | 'debug' | 'run_tests' | 'next_line_hint';
      problemId?: string;
      problem?: LeetCodeProblem;
      language?: CodeLanguage;
      userCode?: string;
      hintIndex?: number;
      testCases?: TestCase[];
    } = body;

    const problem: LeetCodeProblem =
      passedProblem ||
      LEETCODE_PROBLEMS.find((p) => p.id === problemId || p.slug === problemId) ||
      LEETCODE_PROBLEMS[0];

    const targetCases = testCases.length > 0 ? testCases : getProblemTestCases(problem);
    const activeLang = resolveEffectiveLanguage(userCode, language);

    // =========================================================================
    // ACTION 1: SOLVE (LangGraph Framework Stateful Agent Workflow)
    // =========================================================================
    if (action === 'solve') {
      try {
        const graphResult = await runLangGraphCodingAgent({
          problem,
          language: activeLang,
          userCode,
          testCases: targetCases,
          maxIterations: 2,
        });

        return NextResponse.json({
          action: 'solve',
          code: graphResult.code,
          language: activeLang,
          explanation: graphResult.explanation?.coreInvariant || '',
          structuredExplanation: graphResult.explanation,
          timeComplexity: graphResult.explanation?.timeComplexity || 'O(N)',
          spaceComplexity: graphResult.explanation?.spaceComplexity || 'O(1)',
          testResults: graphResult.testResults,
          allPassed: graphResult.allPassed,
          graphSteps: graphResult.graphSteps,
          source: 'langgraph',
        });
      } catch (graphError: any) {
        console.warn('[CodeTrack Agent] LangGraph fallback:', graphError);
        const sol = generateDeterministicSolution(problem, activeLang);
        return NextResponse.json({
          action: 'solve',
          code: sol.code,
          language: activeLang,
          explanation: sol.explanation,
          structuredExplanation: sol.structuredExplanation,
          timeComplexity: sol.timeComplexity,
          spaceComplexity: sol.spaceComplexity,
          source: 'rule_based',
        });
      }
    }

    // =========================================================================
    // ACTION 2: HINT (Sum & Topic Based Progressive DSA Hints)
    // =========================================================================
    if (action === 'hint') {
      const allHints = getProblemHints(problem);
      const hintData = generateAgentHint(problem, hintIndex);
      return NextResponse.json({
        action: 'hint',
        explanation: hintData.hint,
        hints: allHints,
        socraticQuestion: hintData.socraticQuestion,
        edgeCases: hintData.edgeCasesToWatch,
        hintNumber: hintData.hintNumber,
        totalHints: allHints.length,
        source: 'rule_based',
      });
    }

    // =========================================================================
    // ACTION 2.5: NEXT LINE GUIDANCE (Interactive Agent Help for Next Line)
    // =========================================================================
    if (action === 'next_line_hint') {
      const guidance = generateNextLineGuidance(problem, userCode, activeLang);
      return NextResponse.json({
        action: 'next_line_hint',
        guidance,
        source: 'agent_step_assistant',
      });
    }

    // =========================================================================
    // ACTION 3: DEBUG (Real execution diagnosis, bug finding & auto-correct fix)
    // =========================================================================
    if (action === 'debug') {
      const repairedUserCode = repairStrandedCode(userCode, activeLang);
      const executionResults = await executeCodeTests(repairedUserCode, activeLang, problem, targetCases);
      const allPassed = executionResults.length > 0 && executionResults.every((t) => t.passed === true);
      const failed = executionResults.find((t) => !t.passed);
      const diagnostic = diagnoseTestFailure(problem, repairedUserCode, activeLang, executionResults);

      let bugsFound: string[] = [];
      let explanation = '';
      let recommendedFixCode = '';

      if (allPassed) {
        bugsFound = [];
        explanation = '🎉 Perfect! All test cases passed with zero errors. Your solution is 100% verified and ready for LeetCode!';
        recommendedFixCode = '';
      } else {
        if (failed?.error) {
          bugsFound.push(failed.error);
        } else if (diagnostic.whatIsWrong) {
          bugsFound.push(diagnostic.whatIsWrong);
        } else if (failed?.actualOutput) {
          bugsFound.push(`Output mismatch on ${failed.name}: expected ${failed.expectedOutput}, received ${failed.actualOutput}`);
        }

        const deterministic = generateDeterministicSolution(problem, activeLang);
        recommendedFixCode = deterministic.code;
        explanation = diagnostic.whatYouShouldDo || 'Algorithm adjustments required to satisfy test cases.';
      }

      return NextResponse.json({
        action: 'debug',
        bugsFound,
        recommendedFix: explanation,
        recommendedFixCode,
        testResults: executionResults,
        allPassed,
        diagnostic,
        explanation,
        language: activeLang,
        source: 'langgraph_diagnostics',
      });
    }

    // =========================================================================
    // ACTION 4: RUN TESTS (Genuine Execution against Real Test Runner)
    // =========================================================================
    if (action === 'run_tests') {
      const repairedUserCode = repairStrandedCode(userCode, activeLang);
      const results = await executeCodeTests(repairedUserCode, activeLang, problem, targetCases);
      const allPassed = results.length > 0 && results.every((tc) => tc.passed === true);
      const diagnostic = diagnoseTestFailure(problem, repairedUserCode, activeLang, results);
      return NextResponse.json({
        action: 'run_tests',
        testResults: results,
        allPassed,
        diagnostic,
        language: activeLang,
        explanation: allPassed
          ? `All ${results.length} test cases passed successfully! Ready for LeetCode!`
          : diagnostic.whatIsWrong,
        source: 'real_execution_runner',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[CodeTrack Agent API] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Agent error',
        details: error?.details || error?.stack || String(error),
      },
      { status: 500 }
    );
  }
}
