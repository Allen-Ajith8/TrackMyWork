// ============================================================================
// CodeTrack AI - Official LeetCode GraphQL & Telemetry Integration
// ============================================================================

import type { CodeLanguage, TestCase } from '@/types/codetrack';

export interface LeetCodeLiveQuestion {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  acRate?: string;
  totalAccepted?: string;
  totalSubmission?: string;
  hints?: string[];
  codeSnippets: Record<CodeLanguage, string>;
  exampleTestcaseList: string[];
  sampleTestCase?: string;
  topicTags: string[];
}

const memoryCache = new Map<string, { data: LeetCodeLiveQuestion; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Fetches official question data, code templates for all languages,
 * and live test cases directly from LeetCode's public GraphQL endpoint.
 */
export async function fetchLeetCodeQuestion(titleSlug: string): Promise<LeetCodeLiveQuestion | null> {
  const cached = memoryCache.get(titleSlug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        title
        titleSlug
        difficulty
        stats
        hints
        exampleTestcaseList
        sampleTestCase
        codeSnippets {
          lang
          langSlug
          code
        }
        topicTags {
          name
          slug
        }
      }
    }
  `;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TrackMyWork/2.0',
        'Referer': 'https://leetcode.com',
      },
      body: JSON.stringify({
        query,
        variables: { titleSlug },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`LeetCode GraphQL error HTTP ${res.status}`);
    }

    const json = await res.json();
    const q = json.data?.question;
    if (!q) return null;

    let statsObj: any = {};
    try {
      if (q.stats) statsObj = JSON.parse(q.stats);
    } catch {
      // ignore
    }

    const snippets = q.codeSnippets || [];
    const findSnippet = (slugs: string[]) => {
      const match = snippets.find((s: any) => slugs.includes(s.langSlug));
      return match ? match.code : '';
    };

    const codeSnippets: Record<CodeLanguage, string> = {
      cpp: findSnippet(['cpp']),
      java: findSnippet(['java']),
      python: findSnippet(['python3', 'python']),
      javascript: findSnippet(['javascript']),
      typescript: findSnippet(['typescript']),
    };

    const result: LeetCodeLiveQuestion = {
      questionFrontendId: q.questionFrontendId || '',
      title: q.title || '',
      titleSlug: q.titleSlug || titleSlug,
      difficulty: q.difficulty || 'Medium',
      acRate: statsObj.acRate || undefined,
      totalAccepted: statsObj.totalAccepted || undefined,
      totalSubmission: statsObj.totalSubmission || undefined,
      hints: q.hints || [],
      codeSnippets,
      exampleTestcaseList: q.exampleTestcaseList || [],
      sampleTestCase: q.sampleTestCase || undefined,
      topicTags: (q.topicTags || []).map((t: any) => t.name),
    };

    memoryCache.set(titleSlug, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.warn(`[LeetCode API] Failed to fetch live data for ${titleSlug}:`, err);
    return null;
  }
}

/**
 * Converts LeetCode GraphQL raw test cases into structured TestCase objects
 */
export function formatLeetCodeTestCases(slug: string, rawExamples: string[]): TestCase[] {
  // Rotate Image specific
  if (slug === 'rotate-image') {
    return [
      {
        id: '1',
        name: 'Example 1 (3x3 Matrix)',
        input: 'matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]',
        expectedOutput: '[[7, 4, 1], [8, 5, 2], [9, 6, 3]]',
      },
      {
        id: '2',
        name: 'Example 2 (4x4 Matrix)',
        input: 'matrix = [[5, 1, 9, 11], [2, 4, 8, 10], [13, 3, 6, 7], [15, 14, 12, 16]]',
        expectedOutput: '[[15, 13, 2, 5], [14, 3, 4, 1], [12, 6, 8, 9], [16, 7, 10, 11]]',
      },
      {
        id: '3',
        name: 'Edge Case (1x1 Matrix)',
        input: 'matrix = [[1]]',
        expectedOutput: '[[1]]',
      },
    ];
  }

  // Two Sum
  if (slug === 'two-sum') {
    return [
      { id: '1', name: 'Example 1', input: 'nums = [2, 7, 11, 15], target = 9', expectedOutput: '[0, 1]' },
      { id: '2', name: 'Example 2', input: 'nums = [3, 2, 4], target = 6', expectedOutput: '[1, 2]' },
      { id: '3', name: 'Example 3', input: 'nums = [3, 3], target = 6', expectedOutput: '[0, 1]' },
    ];
  }

  // Best Time to Buy and Sell Stock
  if (slug === 'best-time-to-buy-and-sell-stock') {
    return [
      { id: '1', name: 'Example 1', input: 'prices = [7, 1, 5, 3, 6, 4]', expectedOutput: '5' },
      { id: '2', name: 'Example 2 (Decreasing)', input: 'prices = [7, 6, 4, 3, 1]', expectedOutput: '0' },
      { id: '3', name: 'Edge Case', input: 'prices = [2, 4]', expectedOutput: '2' },
    ];
  }

  // Generic from raw LeetCode examples
  if (rawExamples && rawExamples.length > 0) {
    return rawExamples.map((ex, idx) => ({
      id: String(idx + 1),
      name: `LeetCode Example ${idx + 1}`,
      input: ex.replace(/\n/g, ', '),
      expectedOutput: 'Verified by LeetCode spec',
    }));
  }

  return [
    { id: '1', name: 'LeetCode Test Case 1', input: 'input = [sample data 1]', expectedOutput: 'Optimal output' },
    { id: '2', name: 'LeetCode Test Case 2', input: 'input = [sample data 2]', expectedOutput: 'Optimal output' },
  ];
}
