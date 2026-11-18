// ============================================================================
// TrackMyWork - AI Courtroom NIM Client
// Phase 2: Resilient OpenAI-compatible NVIDIA NIM client with role-to-model
// routing, timeouts, 429 backoff, fallback models, and <think> tag stripping.
// ============================================================================

import type { CourtRole } from './types';

const NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;

if (!NIM_API_KEY) {
  // Lazy throw at call time so module import doesn't fail during build.
  console.warn('[Courtroom NIM] NVIDIA_NIM_API_KEY not configured — NIM calls will fail.');
}

// ---------------------------------------------------------------------------
// Role-to-model routing table (exact free-tier NIM slugs from spec)
// ---------------------------------------------------------------------------

type ModelPair = { primary: string; fallback: string };

const ROLE_MODEL_MAP: Record<CourtRole, ModelPair> = {
  'Clerk Router': {
    primary: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    fallback: 'nvidia/nemotron-3.5-bolt-e4b',
  },
  'Visionary Counsel': {
    primary: 'moonshotai/kimi-k3.1-pro',
    fallback: 'mistralai/mistral-large-4',
  },
  'Feasibility Prosecutor': {
    primary: 'nvidia/nemotron-3-ultra-550b-a55b',
    fallback: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
  },
  'Architect Counsel': {
    primary: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
    fallback: 'mistralai/mistral-large-4',
  },
  'Security Witness': {
    primary: 'minimaxai/minimax-m3.1-flash',
    fallback: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  },
  'UX Witness': {
    primary: 'z-ai/glm-5-3-flash',
    fallback: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  },
  'Presiding Judge': {
    primary: 'deepseek-ai/deepseek-v4.1-flash',
    fallback: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
  },
} as const;

function getModelPair(role: CourtRole): ModelPair {
  return ROLE_MODEL_MAP[role];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function stripJsonFences(text: string): string {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/gi, '')
    .trim();
}

function jitterDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface NimRawResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string | null };
    finish_reason: string;
    index: number;
  }>;
  model: string;
}

/**
 * Single NIM chat/completions request with timeout + retry/backoff on 429/5xx.
 * Tries `primary` model first; on 429/5xx or timeout, fails over to `fallback`.
 */
async function callNimWithFallback({
  role,
  modelOverride,
  messages,
  temperature,
  maxTokens,
  timeoutMs,
  responseFormat,
}: {
  role: CourtRole;
  modelOverride?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseFormat?: { type: 'json_object' };
}): Promise<{ text: string; modelUsed: string }> {
  if (!NIM_API_KEY) {
    throw new Error('NVIDIA_NIM_API_KEY not configured — set it in .env.local');
  }

  const pair = modelOverride
    ? { primary: modelOverride, fallback: modelOverride }
    : getModelPair(role);

  const attempts: Array<{ model: string; kind: 'primary' | 'fallback' }> = [
    { model: pair.primary, kind: 'primary' },
    { model: pair.fallback, kind: 'fallback' },
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      const controller = new AbortController();
      const timeoutId =
        timeoutMs !== undefined
          ? setTimeout(() => controller.abort(), timeoutMs)
          : null;

      const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NIM_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: attempt.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
        signal: controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      // Retryable: 429 rate limit or 5xx server error -> backoff + fallback
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        const body = await response.text().catch(() => '');
        lastError = new Error(
          `NIM ${attempt.kind} model ${attempt.model} returned ${response.status}: ${body.slice(0, 200)}`
        );
        await sleep(jitterDelay(600, 1200));
        continue; // try fallback
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `NIM API error: ${response.status} - ${body.slice(0, 200)}`
        );
      }

      const json = (await response.json()) as NimRawResponse;
      const content = json.choices[0]?.message?.content || '';
      return { text: content, modelUsed: json.model || attempt.model };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error(
          `NIM ${attempt.kind} model ${attempt.model} timed out after ${timeoutMs}ms`
        );
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
      // If this was the fallback attempt, stop retrying.
      if (attempt.kind === 'fallback') break;
      // Otherwise try fallback.
    }
  }

  throw lastError || new Error(`NIM call failed for role ${role}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface InvokeTextParams {
  role: CourtRole;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface InvokeJsonParams<T = unknown> {
  role: CourtRole;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export interface InvokeResult<T = unknown> {
  data: T;
  modelUsed: string;
}

/**
 * Invoke NIM for plain text output (courtroom speeches, ~500 words).
 * Strips <think>...</think> reasoning preambles before returning.
 *
 * Default maxTokens = 750 (for ~450–550 word opening/rebuttal speeches).
 * Default timeout = 12000ms.
 */
export async function invokeCourtroomText({
  role,
  systemPrompt,
  userPrompt,
  maxTokens = 750,
  temperature = 0.3,
}: InvokeTextParams): Promise<{ text: string; modelUsed: string }> {
  const result = await callNimWithFallback({
    role,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    maxTokens,
    timeoutMs: 12000,
  });

  return {
    text: stripThinkTags(result.text),
    modelUsed: result.modelUsed,
  };
}

/**
 * Invoke NIM for structured JSON output (persona contracts).
 * Strips <think>...</think> blocks and ```json fences, then JSON.parse.
 * One automatic repair/fallback retry if malformed.
 *
 * Default maxTokens = 750. Default timeout = 8000ms (lightweight JSON).
 */
export async function invokeCourtroomJson<T = unknown>({
  role,
  systemPrompt,
  userPrompt,
  maxTokens = 750,
}: InvokeJsonParams<T>): Promise<InvokeResult<T>> {
  const result = await callNimWithFallback({
    role,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens,
    timeoutMs: 8000,
    responseFormat: { type: 'json_object' },
  });

  let cleaned = stripThinkTags(result.text);
  cleaned = stripJsonFences(cleaned);

  try {
    return { data: JSON.parse(cleaned) as T, modelUsed: result.modelUsed };
  } catch {
    // Automatic repair: try to extract the first balanced JSON object.
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return { data: JSON.parse(candidate) as T, modelUsed: result.modelUsed };
      } catch {
        // Fall through to error below.
      }
    }

    throw new Error(
      `Failed to parse NIM JSON output for role ${role} (model ${result.modelUsed}): ${cleaned.slice(0, 200)}`
    );
  }
}
