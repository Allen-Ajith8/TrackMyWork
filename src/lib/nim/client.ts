// ============================================================================
// TrackMyWork - NVIDIA NIM Client
// ============================================================================

interface NimMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface NimRequest {
  model: string;
  messages: NimMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface NimChoice {
  message: NimMessage;
  finish_reason: string;
  index: number;
}

interface NimUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface NimResponse {
  id: string;
  choices: NimChoice[];
  usage: NimUsage;
  model: string;
}

interface StreamChunk {
  choices: { delta: { content?: string }; finish_reason: string | null }[];
}

const NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;

const MODELS = {
  llama33_70b: process.env.NIM_MODEL_LLAMA_3_3_70B || 'meta/llama-3.3-70b-instruct',
  deepseek_r1: process.env.NIM_MODEL_DEEPSEEK_R1 || 'deepseek-ai/deepseek-r1',
  qwen_coder: process.env.NIM_MODEL_QWEN_CODER || 'qwen/qwen2.5-coder-32b-instruct',
} as const;

async function fetchNim(request: NimRequest): Promise<NimResponse> {
  if (!NIM_API_KEY) {
    throw new Error('NVIDIA_NIM_API_KEY not configured');
  }

  const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NIM_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NIM API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function* streamNim(request: NimRequest): AsyncGenerator<string, void, unknown> {
  if (!NIM_API_KEY) {
    throw new Error('NVIDIA_NIM_API_KEY not configured');
  }

  const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NIM_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NIM API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) return;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed: StreamChunk = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class NimClient {
  // Task Summarization & Jury Alignment (Llama 3.3 70B)
  async summarizeTask(
    commits: { sha: string; message: string; author: string; files: string[] }[],
    taskTitle: string,
    taskDescription: string | null
  ): Promise<string> {
    const systemPrompt = `You are an expert technical writer summarizing GitHub commits for hackathon task tracking.
Generate a concise, non-technical summary suitable for a Pitch/Media team member.
Focus on: what was built, user-facing changes, and impact. Avoid jargon.`;

    const userPrompt = `Task: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}

Recent Commits:
${commits.map((c) => `- ${c.sha.slice(0, 7)}: ${c.message} (by ${c.author}, files: ${c.files.join(', ')})`).join('\n')}

Provide a 2-3 sentence summary for the Pitch team.`;

    const response = await fetchNim({
      model: MODELS.llama33_70b,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content?.trim() || 'No summary generated.';
  }

  async alignWithJury(
    juryExpectations: string,
    recentCommits: { sha: string; message: string; diffSummary: string }[],
    tasksCompleted: string[],
    tasksPending: string[]
  ): Promise<{ alignment: number; feedback: string; scopeCreep: string[]; mockQA: { question: string; answer: string }[] }> {
    const systemPrompt = `You are a hackathon jury evaluator. Analyze project progress against jury expectations.
Return JSON with: alignment (0-100), feedback, scopeCreep (array), mockQA (array of Q&A).`;

    const userPrompt = `Jury Expectations:
${juryExpectations}

Recent Commits:
${recentCommits.map((c) => `- ${c.sha.slice(0, 7)}: ${c.message} - ${c.diffSummary}`).join('\n')}

Completed Tasks: ${tasksCompleted.join(', ') || 'None'}
Pending Tasks: ${tasksPending.join(', ') || 'None'}

Evaluate alignment and detect scope creep.`;

    const response = await fetchNim({
      model: MODELS.llama33_70b,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    try {
      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch {
      return { alignment: 0, feedback: 'Failed to parse response', scopeCreep: [], mockQA: [] };
    }
  }

  async generateMockJuryQA(juryExpectations: string, projectSummary: string): Promise<{ question: string; answer: string }[]> {
    const response = await fetchNim({
      model: MODELS.llama33_70b,
      messages: [
        {
          role: 'system',
          content: 'Generate 5 realistic jury Q&A pairs for a hackathon project. Return JSON array.',
        },
        {
          role: 'user',
          content: `Jury Expectations: ${juryExpectations}\nProject: ${projectSummary}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    try {
      return JSON.parse(response.choices[0]?.message?.content || '[]');
    } catch {
      return [];
    }
  }

  // PR Code Review & Debugging (DeepSeek-R1 / Qwen Coder)
  async reviewCode(
    diff: string,
    language: string,
    context?: string
  ): Promise<{ issues: { severity: 'critical' | 'warning' | 'info'; message: string; line?: number }[]; summary: string }> {
    const model = language.toLowerCase().includes('rust') ? MODELS.deepseek_r1 : MODELS.qwen_coder;

    const response = await fetchNim({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert code reviewer. Analyze the diff for bugs, security issues, performance problems, and best practices.
Return JSON with: issues (array of {severity, message, line}), summary.`,
        },
        {
          role: 'user',
          content: `Language: ${language}\n${context ? `Context: ${context}\n` : ''}Diff:\n${diff}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    try {
      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch {
      return { issues: [], summary: 'Review failed to parse' };
    }
  }

  async debugError(
    errorLog: string,
    context: 'android_logcat' | 'rust_compiler' | 'flutter_build' | 'general',
    relevantFiles: string[]
  ): Promise<{ rootCause: string; solution: string; commands: string[] }> {
    const model = context === 'rust_compiler' ? MODELS.deepseek_r1 : MODELS.qwen_coder;

    const response = await fetchNim({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert debugger for ${context}. Analyze the error and provide root cause, solution, and commands to fix.
Return JSON with: rootCause, solution, commands (array).`,
        },
        {
          role: 'user',
          content: `Context: ${context}\nRelevant Files: ${relevantFiles.join(', ')}\n\nError Log:\n${errorLog}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1200,
    });

    try {
      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch {
      return { rootCause: 'Unknown', solution: 'Failed to analyze', commands: [] };
    }
  }

  async translateToNonTechnical(commitMessage: string, diffSummary: string): Promise<string> {
    const response = await fetchNim({
      model: MODELS.llama33_70b,
      messages: [
        {
          role: 'system',
          content: 'Translate technical commit into 1 sentence for non-technical team members (Pitch/Media). Focus on user value.',
        },
        {
          role: 'user',
          content: `Commit: ${commitMessage}\nChanges: ${diffSummary}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    return response.choices[0]?.message?.content?.trim() || 'Technical update completed.';
  }

  async calculateHardwareCosts(
    components: { name: string; qty: number; specs?: string }[],
    type: 'prototype' | 'mass_production'
  ): Promise<{ component: string; unitCost: number; totalCost: number; notes: string }[]> {
    const response = await fetchNim({
      model: MODELS.llama33_70b,
      messages: [
        {
          role: 'system',
          content: `Estimate ${type} costs for hardware components. Return JSON array with component, unitCost, totalCost, notes.
Use current market prices. Consider volume discounts for mass_production.`,
        },
        {
          role: 'user',
          content: components.map((c) => `- ${c.name} x${c.qty}${c.specs ? ` (${c.specs})` : ''}`).join('\n'),
        },
      ],
      temperature: 0.2,
      max_tokens: 600,
    });

    try {
      return JSON.parse(response.choices[0]?.message?.content || '[]');
    } catch {
      return [];
    }
  }

  // Streaming helpers
  async *streamTaskSummary(
    commits: { sha: string; message: string; author: string; files: string[] }[],
    taskTitle: string,
    taskDescription: string | null
  ): AsyncGenerator<string> {
    const systemPrompt = `You are an expert technical writer summarizing GitHub commits for hackathon task tracking.
Generate a concise, non-technical summary suitable for a Pitch/Media team member.`;

    const userPrompt = `Task: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}

Recent Commits:
${commits.map((c) => `- ${c.sha.slice(0, 7)}: ${c.message} (by ${c.author}, files: ${c.files.join(', ')})`).join('\n')}

Provide a 2-3 sentence summary for the Pitch team.`;

    for await (const chunk of streamNim({
      model: MODELS.llama33_70b,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    })) {
      yield chunk;
    }
  }
// Raw call for flexible usage (Discord, etc.)
  async callNimRaw(
    messages: NimMessage[],
    model: string = MODELS.llama33_70b,
    temperature: number = 0.3,
    maxTokens: number = 1000
  ): Promise<NimResponse> {
    return fetchNim({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
  }
}

export const nimClient = new NimClient();
