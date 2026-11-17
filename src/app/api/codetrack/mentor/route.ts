import { NextRequest, NextResponse } from 'next/server';
import { getMentorReply } from '@/lib/codetrack/mentor';
import { LEETCODE_PROBLEMS, DSA_TOPICS } from '@/lib/codetrack/data';
import type {
  DSALevel,
  PreferredDifficulty,
  UserProblemProgress,
  IndependenceLevel,
  ConfidenceLevel,
  NextPreference,
} from '@/types/codetrack';

const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;
const NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NIM_MODEL = process.env.NIM_MODEL_LLAMA_3_3_70B || 'meta/llama-3.3-70b-instruct';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userLevel = 'beginner',
      preferredDifficulty = 'Mixed Practice',
      currentTopicId = 'arrays',
      progressMap = {},
      userQuery = '',
      recentDebrief,
    }: {
      userLevel: DSALevel;
      preferredDifficulty?: PreferredDifficulty;
      currentTopicId: string;
      progressMap: Record<string, UserProblemProgress>;
      userQuery?: string;
      recentDebrief?: {
        problemId: string;
        independence?: IndependenceLevel;
        challengeFaced?: string;
        confidence?: ConfidenceLevel;
        preferredNext?: NextPreference;
      };
    } = body;

    // Run deterministic adaptive logic first
    const ruleBasedResult = await getMentorReply({
      userLevel,
      preferredDifficulty,
      currentTopicId,
      progressMap,
      userQuery,
      recentDebrief,
    });

    // If NVIDIA NIM API key is configured, enhance response with LLM
    if (NIM_API_KEY && NIM_API_KEY !== 'your-nim-api-key') {
      try {
        const solvedCount = Object.values(progressMap).filter((p) => p.status === 'solved').length;
        const currentTopic = DSA_TOPICS.find((t) => t.id === currentTopicId)?.name || 'Arrays';

        const systemPrompt = `You are CodeTrack AI, an elite, personalized DSA mentor.
The developer is on the "${userLevel.toUpperCase()}" track with preferred difficulty "${preferredDifficulty}".
They have solved ${solvedCount} problems. Current topic: "${currentTopic}".
${
  recentDebrief
    ? `Recent Problem Debrief:
- Problem: ${recentDebrief.problemId}
- Independence: ${recentDebrief.independence}
- Challenge faced: ${recentDebrief.challengeFaced || 'none stated'}
- Confidence: ${recentDebrief.confidence}
- User's next preference: ${recentDebrief.preferredNext}`
    : ''
}

Guidelines:
1. Conduct a constructive, motivating, technical conversation (2-3 concise paragraphs).
2. Never increase difficulty without explicit user confirmation.
3. If they struggled or needed hints, reinforce the pattern with intuitive explanations.
4. Explain WHY the next problem was recommended: "${ruleBasedResult.recommendationReason}".
${
  ruleBasedResult.recommendedProblem
    ? `Recommended Problem: #${ruleBasedResult.recommendedProblem.frontendQuestionId} ${ruleBasedResult.recommendedProblem.title} (${ruleBasedResult.recommendedProblem.difficulty}) - ${ruleBasedResult.recommendedProblem.leetcodeUrl}`
    : ''
}
`;

        const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${NIM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: NIM_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userQuery || 'Please review my debrief and recommend my next step.' },
            ],
            temperature: 0.6,
            max_tokens: 600,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            return NextResponse.json({
              message: content,
              recommendationReason: ruleBasedResult.recommendationReason,
              recommendedProblem: ruleBasedResult.recommendedProblem,
              recommendedProblems: ruleBasedResult.recommendedProblems,
              suggestions: ruleBasedResult.suggestions,
              source: 'llm',
            });
          }
        }
      } catch (err) {
        console.warn('NIM LLM completion skipped, returning rule-based mentor result:', err);
      }
    }

    return NextResponse.json({
      ...ruleBasedResult,
      source: 'rule_based',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        message: 'Hello! I am your CodeTrack AI mentor. Keep consistent with your DSA problem solving!',
        source: 'rule_based',
        suggestions: [
          { label: 'Recommend next problem', action: 'solve' },
          { label: 'Explore curriculum', action: 'topic' },
        ],
      },
      { status: 200 }
    );
  }
}
