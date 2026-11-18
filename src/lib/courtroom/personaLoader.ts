// ============================================================================
// TrackMyWork - AI Courtroom Persona Loader
// Reads .md persona prompts from personas/ with in-memory caching.
// Supports per-room custom .md string overrides.
// Phase 1B: Persona Loader + XML prompt builders for LangGraph nodes.
// ============================================================================

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { CourtRole } from './types';
import { PERSONA_FILES } from './types';

// In-memory cache for persona prompts (role -> markdown content)
const personaCache = new Map<string, string>();

/**
 * Load a persona prompt from the corresponding .md file in personas/.
 *
 * Falls back to an in-memory cache after the first read. If a
 * `customOverrideMarkdown` is supplied (e.g. a per-room custom override
 * from Supabase Storage), it is returned directly without touching disk.
 *
 * @param role - The court persona role.
 * @param customOverrideMarkdown - Optional per-room custom .md string override.
 * @returns The persona prompt markdown.
 */
export async function loadPersonaPrompt(
  role: CourtRole,
  customOverrideMarkdown?: string
): Promise<string> {
  // Custom override takes precedence — no disk read needed.
  if (customOverrideMarkdown && customOverrideMarkdown.trim().length > 0) {
    return customOverrideMarkdown;
  }

  // Return cached version if available.
  if (personaCache.has(role)) {
    return personaCache.get(role)!;
  }

  const filename = PERSONA_FILES[role];
  const filePath = join(process.cwd(), 'personas', filename);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Persona prompt not found for role "${role}" at ${filePath}. ` +
        'Ensure the personas/ directory contains the required .md files.'
    );
  }

  personaCache.set(role, content);
  return content;
}

/**
 * Clear the persona cache. Useful for tests or after editing .md files.
 */
export function clearPersonaCache(): void {
  personaCache.clear();
}

// ============================================================================
// XML prompt builders — zero string-formatting bugs for LangGraph nodes
// ============================================================================

/**
 * Escape text for safe inclusion inside XML blocks.
 * Strips control characters and escapes any stray tag-like sequences.
 */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/**
 * Build the user prompt for a speaker (Counsel / Witness) turn.
 *
 * Wraps all context in clean XML blocks so the LLM receives a structured
 * input and LangGraph nodes never depend on brittle string concatenation.
 *
 * Blocks:
 *   <mode> — 'phase1_opening' | 'phase2_rebuttal' | 'human_interjection'
 *   <motion> — the proposed feature / PR description
 *   <transcript> — prior turns in this session
 *   <evidence> — citations / context from previous turns
 *   <repo_context> — tech stack locks, agents_md_rules, changed files
 */
export function buildSpeakerUserPrompt({
  mode,
  motion,
  transcript,
  evidence,
  repoContext,
}: {
  mode: string;
  motion: string;
  transcript: string;
  evidence?: string;
  repoContext?: Record<string, unknown>;
}): string {
  const lines: string[] = [];

  lines.push(`<mode>${xmlEscape(mode)}</mode>`);
  lines.push(``);
  lines.push(`<motion>${xmlEscape(motion)}</motion>`);
  lines.push(``);

  if (transcript && transcript.trim().length > 0) {
    lines.push('<transcript>');
    lines.push(xmlEscape(transcript));
    lines.push('</transcript>');
    lines.push(``);
  }

  if (evidence && evidence.trim().length > 0) {
    lines.push('<evidence>');
    lines.push(xmlEscape(evidence));
    lines.push('</evidence>');
    lines.push(``);
  }

  if (repoContext && Object.keys(repoContext).length > 0) {
    lines.push('<repo_context>');
    lines.push(xmlEscape(JSON.stringify(repoContext, null, 2)));
    lines.push('</repo_context>');
    lines.push(``);
  }

  return lines.join('\n').trim();
}

/**
 * Build the prompt for the Judge reviewing floor petitions.
 *
 * Blocks:
 *   <mode> — 'judge_gavel' | 'phase2_rebuttal'
 *   <motion> — the proposed feature / PR description
 *   <transcript> — prior turns in this session
 *   <petitions> — pending floor petitions with speaker_role, grounds, justification
 *   <phase2_state> — phase2_grants_used, round_number, remaining grants
 */
export function buildJudgePetitionReviewPrompt({
  mode,
  motion,
  transcript,
  petitions,
  phase2State,
}: {
  mode: string;
  motion: string;
  transcript: string;
  petitions: Array<{
    speaker_role: string;
    wants_floor: boolean;
    grounds: string | null;
    target_role: string | null;
    justification: string;
  }>;
  phase2State: {
    phase2_grants_used: number;
    round_number: number;
  };
}): string {
  const lines: string[] = [];

  lines.push(`<mode>${xmlEscape(mode)}</mode>`);
  lines.push(``);
  lines.push(`<motion>${xmlEscape(motion)}</motion>`);
  lines.push(``);

  if (transcript && transcript.trim().length > 0) {
    lines.push('<transcript>');
    lines.push(xmlEscape(transcript));
    lines.push('</transcript>');
    lines.push(``);
  }

  lines.push('<petitions>');
  for (const petition of petitions) {
    lines.push('  <petition>');
    lines.push(`    <speaker_role>${xmlEscape(petition.speaker_role)}</speaker_role>`);
    lines.push(`    <wants_floor>${petition.wants_floor}</wants_floor>`);
    lines.push(`    <grounds>${xmlEscape(petition.grounds ?? '')}</grounds>`);
    lines.push(`    <target_role>${xmlEscape(petition.target_role ?? '')}</target_role>`);
    lines.push(`    <justification>${xmlEscape(petition.justification)}</justification>`);
    lines.push('  </petition>');
  }
  lines.push('</petitions>');
  lines.push(``);

  lines.push('<phase2_state>');
  lines.push(`    <phase2_grants_used>${phase2State.phase2_grants_used}</phase2_grants_used>`);
  lines.push(`    <round_number>${phase2State.round_number}</round_number>`);
  lines.push('</phase2_state>');

  return lines.join('\n').trim();
}

/**
 * Build the prompt for the Judge's final synthesis (gavel ruling).
 *
 * Blocks:
 *   <mode> — always 'judge_gavel' for final synthesis
 *   <motion> — the proposed feature / PR description
 *   <transcript> — full debate transcript
 *   <evidence> — all citations from the session
 *   <repo_context> — tech stack locks, agents_md_rules, changed files
 *   <petitions> — all petitions and judge decisions
 *   <phase2_state> — final phase 2 grant usage
 */
export function buildJudgeSynthesisPrompt({
  mode,
  motion,
  transcript,
  evidence,
  repoContext,
  petitions,
  phase2State,
}: {
  mode: string;
  motion: string;
  transcript: string;
  evidence?: string;
  repoContext?: Record<string, unknown>;
  petitions: Array<{
    speaker_role: string;
    wants_floor: boolean;
    grounds: string | null;
    target_role: string | null;
    justification: string;
    judge_decision: string;
    judge_reason: string | null;
  }>;
  phase2State: {
    phase2_grants_used: number;
    round_number: number;
  };
}): string {
  const lines: string[] = [];

  lines.push(`<mode>${xmlEscape(mode)}</mode>`);
  lines.push(``);
  lines.push(`<motion>${xmlEscape(motion)}</motion>`);
  lines.push(``);

  if (transcript && transcript.trim().length > 0) {
    lines.push('<transcript>');
    lines.push(xmlEscape(transcript));
    lines.push('</transcript>');
    lines.push(``);
  }

  if (evidence && evidence.trim().length > 0) {
    lines.push('<evidence>');
    lines.push(xmlEscape(evidence));
    lines.push('</evidence>');
    lines.push(``);
  }

  if (repoContext && Object.keys(repoContext).length > 0) {
    lines.push('<repo_context>');
    lines.push(xmlEscape(JSON.stringify(repoContext, null, 2)));
    lines.push('</repo_context>');
    lines.push(``);
  }

  lines.push('<petitions>');
  for (const petition of petitions) {
    lines.push('  <petition>');
    lines.push(`    <speaker_role>${xmlEscape(petition.speaker_role)}</speaker_role>`);
    lines.push(`    <wants_floor>${petition.wants_floor}</wants_floor>`);
    lines.push(`    <grounds>${xmlEscape(petition.grounds ?? '')}</grounds>`);
    lines.push(`    <target_role>${xmlEscape(petition.target_role ?? '')}</target_role>`);
    lines.push(`    <justification>${xmlEscape(petition.justification)}</justification>`);
    lines.push(`    <judge_decision>${xmlEscape(petition.judge_decision)}</judge_decision>`);
    lines.push(`    <judge_reason>${xmlEscape(petition.judge_reason ?? '')}</judge_reason>`);
    lines.push('  </petition>');
  }
  lines.push('</petitions>');
  lines.push(``);

  lines.push('<phase2_state>');
  lines.push(`    <phase2_grants_used>${phase2State.phase2_grants_used}</phase2_grants_used>`);
  lines.push(`    <round_number>${phase2State.round_number}</round_number>`);
  lines.push('</phase2_state>');

  return lines.join('\n').trim();
}
