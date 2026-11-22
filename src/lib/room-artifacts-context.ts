import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfiguredForData } from '@/lib/supabase-config';
import { getFallbackDemoRoom } from '@/lib/dashboard-data';
import { artifactText, isTextLikeFile } from '@/lib/artifact-text';
import { listRememberedArtifacts } from '@/lib/artifact-store';
import type { Artifact } from '@/types/database';

export interface RoomArtifactReference {
  id: string;
  title: string;
  type: string;
  kind: string;
  isRulebook: boolean;
  hasText: boolean;
  excerptChars: number;
  url?: string | null;
  createdAt?: string | null;
}

export interface RoomArtifactsContext {
  /** Formatted `[ROOM ARTIFACTS & RULEBOOKS]` prompt block. */
  context: string;
  /** Every artifact that contributed text to the prompt block. */
  artifacts: RoomArtifactReference[];
  /** Convenience aliases for callers that want explicit naming. */
  referencedArtifacts: RoomArtifactReference[];
  referencedArtifactIds: string[];
  referencedArtifactTitles: string[];
  /** Total characters of artifact text injected into the prompt. */
  totalChars: number;
  /** True when a rules.md/rulebook/rubric-style document was included. */
  hasRulebook: boolean;
}

export interface GetRoomArtifactsContextOptions {
  /** Maximum characters of artifact text across the whole block. */
  maxTotalChars?: number;
  /** Maximum number of artifacts included in the block. */
  maxArtifacts?: number;
  /** Fetch old text-like artifacts that have no stored text yet. */
  hydrateMissingText?: boolean;
  /** Include the room's rules_text / judging_rubric fields as a rulebook. */
  includeRoomRules?: boolean;
}

const RULEBOOK_PATTERN =
  /(^|[/_.\-\s])(rules?|rulebook|rubric|constraints?|requirements?|guidelines?|judging|criteria|spec(?:ification)?s?|handbook|readme)([/_.\-\s]|$)/i;

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'our',
  'that',
  'the',
  'this',
  'to',
  'was',
  'we',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'you',
  'your',
]);

const DEFAULT_MAX_TOTAL_CHARS = 26_000;
const DEFAULT_MAX_ARTIFACTS = 8;

function isConfigured(): boolean {
  return isSupabaseConfiguredForData();
}

function artifactKind(artifact: Partial<Artifact>): string {
  if (artifact.kind) return String(artifact.kind);
  if (artifact.type === 'note') return 'note';
  if (artifact.type === 'reference') return 'reference';
  return 'file';
}

export function isRulebookArtifact(artifact: {
  name?: string | null;
  tags?: string[] | null;
  type?: string | null;
  kind?: string | null;
}): boolean {
  const name = String(artifact.name || '');
  const tags = (artifact.tags || []).join(' ');
  const type = String(artifact.type || '');
  const kind = String(artifact.kind || '');
  return (
    RULEBOOK_PATTERN.test(name) ||
    RULEBOOK_PATTERN.test(tags) ||
    /rulebook|rubric|constraint|spec/i.test(kind) ||
    (type === 'document' && /rules?/i.test(name))
  );
}

function tokenize(query?: string): string[] {
  if (!query) return [];
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9+#.\-\s]/g, ' ')
        .split(/\s+/)
        .map((token) => token.replace(/^[.\-]+|[.\-]+$/g, ''))
        .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    )
  ).slice(0, 24);
}

function scoreArtifact(
  artifact: Partial<Artifact>,
  text: string,
  tokens: string[],
  isRulebook: boolean
): number {
  let score = isRulebook ? 1_000 : 0;
  const haystackTitle = `${artifact.name || ''} ${(artifact.tags || []).join(' ')}`.toLowerCase();
  const haystackText = text.toLowerCase();

  for (const token of tokens) {
    if (haystackTitle.includes(token)) score += 24;
    if (haystackText.includes(token)) score += 2;
  }

  if (artifact.is_final) score += 3;
  if (artifact.type === 'document') score += 2;
  return score;
}

function perArtifactBudget(isRulebook: boolean, type?: string | null): number {
  if (isRulebook) return 8_000;
  if (type === 'document') return 5_000;
  if (type === 'reference' || type === 'note') return 2_500;
  return 900;
}

function smartExcerpt(text: string, budget: number, query?: string): string {
  const clean = text.replace(/\u0000/g, '').trim();
  if (clean.length <= budget) return clean;

  const tokens = tokenize(query);
  if (tokens.length > 0) {
    const lower = clean.toLowerCase();
    let bestIndex = -1;
    for (const token of tokens) {
      const index = lower.indexOf(token);
      if (index >= 0 && (bestIndex < 0 || index < bestIndex)) bestIndex = index;
    }
    if (bestIndex > budget * 0.35) {
      const start = Math.max(0, bestIndex - Math.floor(budget * 0.2));
      return `…${clean.slice(start, start + budget).trim()}…`;
    }
  }

  return `${clean.slice(0, budget).trimEnd()}…`;
}

function buildRoomRulesText(room: Record<string, unknown> | null): string {
  if (!room) return '';
  const sections: string[] = [];

  const add = (label: string, value: unknown) => {
    const text = String(value || '').trim();
    if (text) sections.push(`${label}:\n${text}`);
  };

  add('Official room rules / constraints', room.rules_text);
  add('Judging rubric', room.judging_rubric);
  add('Allowed technology / tech stack locks', room.allowed_tech);
  add('Submission format', room.submission_format);
  add('Problem statement', room.problem_statement);
  add('Jury expectations', room.jury_expectations);

  return sections.join('\n\n');
}

async function hydrateArtifactText(artifact: Partial<Artifact>): Promise<string> {
  const existing = artifactText(artifact);
  if (existing) return existing;

  const url = String(artifact.url || artifact.file_url || '');
  const fileName = String(artifact.file_name || artifact.name || '');
  if (!url.startsWith('http') || !isTextLikeFile(fileName, artifact.mime_type)) {
    return '';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    if (!response.ok) return '';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 2_000_000) return '';
    return buffer.toString('utf8').trim();
  } catch {
    return '';
  }
}

async function loadArtifacts(roomId: string): Promise<{
  room: Record<string, unknown> | null;
  artifacts: Partial<Artifact>[];
}> {
  const remembered = listRememberedArtifacts(roomId);

  if (!isConfigured()) {
    const demo = getFallbackDemoRoom(roomId);
    const demoArtifacts = demo.artifacts as unknown as Partial<Artifact>[];
    const merged = [
      ...remembered,
      ...demoArtifacts.filter(
        (demoArtifact) => !remembered.some((artifact) => artifact.id === demoArtifact.id)
      ),
    ];
    return {
      room: demo.room as unknown as Record<string, unknown>,
      artifacts: merged,
    };
  }

  const admin = createAdminClient();

  const [roomResult, artifactsResult] = await Promise.all([
    admin.from('rooms').select('*').eq('id', roomId).maybeSingle(),
    admin
      .from('artifacts')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  if (artifactsResult.error) {
    // Older deployments may not have every optional column. Retry with a
    // conservative projection so artifact context still works.
    const fallback = await admin
      .from('artifacts')
      .select('id, room_id, uploaded_by, name, type, file_url, file_size, mime_type, tags, version, is_final, created_at, updated_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(80);
    return {
      room: (roomResult.data as Record<string, unknown> | null) || null,
      artifacts: [
        ...remembered,
        ...((fallback.data || []) as Partial<Artifact>[]).filter(
          (artifact) => !remembered.some((item) => item.id === artifact.id)
        ),
      ],
    };
  }

  return {
    room: (roomResult.data as Record<string, unknown> | null) || null,
    artifacts: [
      ...remembered,
      ...((artifactsResult.data || []) as Partial<Artifact>[]).filter(
        (artifact) => !remembered.some((item) => item.id === artifact.id)
      ),
    ],
  };
}

/**
 * Fetch the room's artifacts and rulebooks, rank them against the current
 * query, and format a token-bounded prompt block for MICA and Courtroom agents.
 */
export async function getRoomArtifactsContext(
  roomId: string,
  query?: string,
  options: GetRoomArtifactsContextOptions = {}
): Promise<RoomArtifactsContext> {
  const {
    maxTotalChars = DEFAULT_MAX_TOTAL_CHARS,
    maxArtifacts = DEFAULT_MAX_ARTIFACTS,
    hydrateMissingText = true,
    includeRoomRules = true,
  } = options;

  const safeRoomId = String(roomId || '').trim();
  if (!safeRoomId) {
    return emptyContext('No room id was provided.');
  }

  let loaded: { room: Record<string, unknown> | null; artifacts: Partial<Artifact>[] };
  try {
    loaded = await loadArtifacts(safeRoomId);
  } catch (error) {
    console.warn('[room-artifacts-context] Could not load artifacts:', error);
    loaded = { room: null, artifacts: [] };
  }

  const tokens = tokenize(query);
  const candidates = await Promise.all(
    loaded.artifacts.map(async (artifact) => {
      const isRulebook = isRulebookArtifact(artifact);
      let text = artifactText(artifact);
      if (!text && hydrateMissingText) {
        text = await hydrateArtifactText(artifact);
      }
      const normalizedText = text.trim();
      return {
        artifact,
        isRulebook,
        text: normalizedText,
        score: scoreArtifact(artifact, normalizedText, tokens, isRulebook),
      };
    })
  );

  // Prefer artifacts with text, but keep a text-less rulebook entry visible
  // so the UI can still attribute that the rulebook was loaded.
  const ranked = candidates
    .filter((candidate) => candidate.text.length > 0 || candidate.isRulebook)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.artifact.created_at || '').localeCompare(String(a.artifact.created_at || ''));
    })
    .slice(0, Math.max(1, maxArtifacts));

  const roomRulesText = includeRoomRules ? buildRoomRulesText(loaded.room) : '';
  const sections: string[] = [];
  const references: RoomArtifactReference[] = [];
  let totalChars = 0;
  let hasRulebook = false;

  if (roomRulesText) {
    const budget = Math.min(8_000, maxTotalChars);
    const excerpt = smartExcerpt(roomRulesText, budget, query);
    const block = `--- ARTIFACT 1: Room Rules, Rubric & Constraints (room record, rulebook) ---\n${excerpt}`;
    sections.push(block);
    totalChars += excerpt.length;
    hasRulebook = true;
    references.push({
      id: `room-rules:${safeRoomId}`,
      title: 'Room Rules, Rubric & Constraints',
      type: 'document',
      kind: 'rulebook',
      isRulebook: true,
      hasText: true,
      excerptChars: excerpt.length,
      createdAt: null,
    });
  }

  for (const candidate of ranked) {
    if (totalChars >= maxTotalChars) break;

    const { artifact, isRulebook } = candidate;
    const title = String(artifact.name || artifact.file_name || 'Untitled artifact');
    const type = String(artifact.type || 'other');
    const kind = artifactKind(artifact);
    const budget = Math.min(
      perArtifactBudget(isRulebook, type),
      Math.max(400, maxTotalChars - totalChars)
    );
    const excerpt = candidate.text
      ? smartExcerpt(candidate.text, budget, query)
      : '[Text not extracted yet — the artifact is attached but has no readable text.]';
    const sectionNumber = sections.length + 1;

    sections.push(
      `--- ARTIFACT ${sectionNumber}: ${title} (${type}, ${kind}${isRulebook ? ', rulebook' : ''}) ---\n${excerpt}`
    );
    totalChars += excerpt.length;
    if (isRulebook) hasRulebook = true;

    references.push({
      id: String(artifact.id || `artifact-${sectionNumber}`),
      title,
      type,
      kind,
      isRulebook,
      hasText: candidate.text.length > 0,
      excerptChars: excerpt.length,
      url: artifact.url || artifact.file_url || null,
      createdAt: artifact.created_at || null,
    });
  }

  const context =
    sections.length > 0
      ? [
          '[ROOM ARTIFACTS & RULEBOOKS]',
          'The following room artifacts are authoritative ground truth for this room. Use them when answering, checking compliance, debating, or judging.',
          'Rules and rulebooks take precedence over general knowledge. When you rely on an artifact, cite its exact title in backticks (for example `rules.md`).',
          'If an artifact does not cover a question, say so instead of inventing a rule.',
          '',
          sections.join('\n\n'),
          '',
          '[END ROOM ARTIFACTS & RULEBOOKS]',
        ].join('\n')
      : emptyContext('No room artifacts or rulebooks have been uploaded yet.').context;

  return {
    context,
    artifacts: references,
    referencedArtifacts: references,
    referencedArtifactIds: references.map((reference) => reference.id),
    referencedArtifactTitles: references.map((reference) => reference.title),
    totalChars,
    hasRulebook,
  };
}

function emptyContext(reason: string): RoomArtifactsContext {
  return {
    context: [
      '[ROOM ARTIFACTS & RULEBOOKS]',
      reason,
      'If the user asks about room rules, constraints, research, or specs, explain that no artifact has been uploaded to the room yet.',
      '[END ROOM ARTIFACTS & RULEBOOKS]',
    ].join('\n'),
    artifacts: [],
    referencedArtifacts: [],
    referencedArtifactIds: [],
    referencedArtifactTitles: [],
    totalChars: 0,
    hasRulebook: false,
  };
}
