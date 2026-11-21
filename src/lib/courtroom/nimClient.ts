// ============================================================================
// TrackMyWork - AI Courtroom NIM Client
// Phase 2: Resilient OpenAI-compatible NVIDIA NIM client with role-to-model
// routing, timeouts, 429 backoff, fallback models, and <think> tag stripping.
// ============================================================================

import type { CourtRole } from './types';

const NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;

/**
 * Catch the usual key mistakes before burning a request:
 *  - missing key
 *  - the `your-nim-api-key` placeholder from .env.example
 *  - a truncated / non-JWT paste (NIM keys are `nvapi-...` and long)
 * Returns a human-readable reason, or null when the key looks usable.
 */
function describeKeyProblem(key: string | undefined): string | null {
  if (!key || !key.trim()) return 'NVIDIA_NIM_API_KEY is not set in .env.local';
  const value = key.trim();
  if (/^your[-_]/i.test(value) || value === 'your-nim-api-key') {
    return 'NVIDIA_NIM_API_KEY still holds the .env.example placeholder';
  }
  if (!value.startsWith('nvapi-')) {
    return 'NVIDIA_NIM_API_KEY does not look like an NVIDIA key (expected an `nvapi-...` value)';
  }
  if (value.length < 40) {
    return `NVIDIA_NIM_API_KEY looks truncated (${value.length} chars, expected ~70)`;
  }
  return null;
}

const NIM_KEY_PROBLEM = describeKeyProblem(NIM_API_KEY);

if (NIM_KEY_PROBLEM) {
  // Lazy throw at call time so module import doesn't fail during build.
  console.warn(`[Courtroom NIM] ${NIM_KEY_PROBLEM} — NIM calls will fail.`);
}

// ---------------------------------------------------------------------------
// Role-to-model routing table
//
// Every slug below is verified against GET /v1/models for this NVIDIA account.
// Retired slugs return HTTP 410 with an empty body, which used to surface as a
// blank trial failure — so keep this list in sync with the live catalogue.
// ---------------------------------------------------------------------------

type ModelPair = { primary: string; fallback: string };

const ROLE_MODEL_MAP: Record<CourtRole, ModelPair> = {
  'Clerk Router': {
    primary: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    fallback: 'nvidia/nemotron-3.5-bolt-e4b',
  },
  'Visionary Counsel': {
    primary: 'moonshotai/kimi-k3.1-pro',
    fallback: 'mistralai/mistral-large-4-1t-a52b',
  },
  'Feasibility Prosecutor': {
    primary: 'nvidia/nemotron-3-ultra-550b-a55b',
    fallback: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  },
  'Architect Counsel': {
    primary: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
    fallback: 'mistralai/mistral-large-4-1t-a52b',
  },
  'Security Witness': {
    primary: 'minimaxai/minimax-m3.1-flash',
    fallback: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  },
  'UX Witness': {
    primary: 'z-ai/glm-5.3-flash',
    fallback: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  },
  'Presiding Judge': {
    primary: 'nvidia/nemotron-3-ultra-550b-a55b',
    fallback: 'moonshotai/kimi-k3.1-pro',
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

// ---------------------------------------------------------------------------
// Resilient NIM JSON parser
// Handles empty/truncated outputs,  reasoning blocks,
// markdown fences, and conversational text wrapping the JSON object.
// ---------------------------------------------------------------------------

export function parseNimJson<T = unknown>(
  rawContent: string | null | undefined,
  role: string,
  modelUsed: string
): { data: T; modelUsed: string } {
  const raw = rawContent ?? '';

  if (!raw.trim()) {
    console.warn(
      `[Courtroom NIM JSON] role=${role} model=${modelUsed} raw_content="" (empty)`
    );
    throw new Error(
      `Failed to parse NIM JSON output for role ${role} (model ${modelUsed}): empty response content (first 150 chars: "")`
    );
  }

  // Log the raw content so empty/truncated outputs are visible in server logs.
  console.warn(
    `[Courtroom NIM JSON] role=${role} model=${modelUsed} raw_content_preview=${JSON.stringify(
      raw.slice(0, 500)
    )}`
  );

  // Strip  reasoning blocks
  let cleaned = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

  // Strip all markdown code fences (``` ... ``` and ```json ... ```)
  cleaned = cleaned.replace(/```[\s\S]*?```/gi, '').trim();

  // Try direct parse first
  try {
    return { data: JSON.parse(cleaned) as T, modelUsed };
  } catch {
    // Fall through to extraction below.
  }

  // Extract from first { to last } (or [ to ] for arrays)
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  // Prefer object extraction, fall back to array
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return { data: JSON.parse(candidate) as T, modelUsed };
    } catch {
      // Fall through to error below.
    }
  } else if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const candidate = cleaned.slice(firstBracket, lastBracket + 1);
    try {
      return { data: JSON.parse(candidate) as T, modelUsed };
    } catch {
      // Fall through to error below.
    }
  }

  throw new Error(
    `Failed to parse NIM JSON output for role ${role} (model ${modelUsed}): no valid JSON object found (first 150 chars: ${raw.slice(0, 150)})`
  );
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

/** Account-level NIM problem (bad/expired key). Never retried, never fallen back. */
export class FatalNimConfigError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'FatalNimConfigError';
  }
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
  if (NIM_KEY_PROBLEM) {
    throw new Error(`${NIM_KEY_PROBLEM}. Add a valid key from build.nvidia.com and restart the dev server.`);
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

      if (response.status === 401 || response.status === 403) {
        const body = await response.text().catch(() => '');
        // Auth problems are account-level: a fallback model will fail the same
        // way, so surface the real cause instead of a raw provider blob.
        throw new FatalNimConfigError(
          `NVIDIA_NIM_API_KEY was rejected by NVIDIA (${response.status}). ` +
            `Replace it in .env.local with a valid key from build.nvidia.com and restart the dev server. ` +
            `Provider said: ${body.slice(0, 160)}`
        );
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const hint =
          response.status === 404 || response.status === 410
            ? ` (model "${attempt.model}" is not available on this account — retired or unlisted)`
            : '';
        throw new Error(
          `NIM API error: ${response.status}${hint} - ${body.slice(0, 200) || 'empty response body'}`
        );
      }

      const json = (await response.json()) as NimRawResponse;
      const content = json.choices[0]?.message?.content || '';

      // Retryable: empty content (model exhausted max_tokens on reasoning).
      if (!content.trim()) {
        lastError = new Error(
          `NIM ${attempt.kind} model ${attempt.model} returned empty content`
        );
        await sleep(jitterDelay(600, 1200));
        continue; // try fallback
      }

      return { text: content, modelUsed: json.model || attempt.model };
    } catch (error) {
      if (error instanceof FatalNimConfigError) throw error;
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
 * Default maxTokens = 2048. Default timeout = 15000ms.
 */
export async function invokeCourtroomJson<T = unknown>({
  role,
  systemPrompt,
  userPrompt,
  maxTokens = 2048,
}: InvokeJsonParams<T>): Promise<InvokeResult<T>> {
  // Ensure the system prompt explicitly signals JSON output mode.
  const jsonSystemPrompt = /JSON/i.test(systemPrompt)
    ? systemPrompt
    : `${systemPrompt}\n\nIMPORTANT: You MUST respond with valid JSON only. No prose, no markdown fences, no conversational text. Output a single JSON object.`;

  const result = await callNimWithFallback({
    role,
    messages: [
      { role: 'system', content: jsonSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens,
    timeoutMs: 15000,
    responseFormat: { type: 'json_object' },
  });

  return parseNimJson(result.text, role, result.modelUsed);
}
