// ============================================================================
// TrackMyWork - AI Courtroom Types
// Strict TypeScript contracts matching the 7 persona .md files.
// Phase 1B: Persona Loader + input/output contracts for LangGraph nodes.
// ============================================================================

export type CourtRole =
  | 'Clerk Router'
  | 'Visionary Counsel'
  | 'Feasibility Prosecutor'
  | 'Architect Counsel'
  | 'Security Witness'
  | 'UX Witness'
  | 'Presiding Judge';

export interface ClerkRouterOutput {
  needsSecurityWitness: boolean;
  needsUxWitness: boolean;
  reasoning: string;
}

export interface FloorPetitionOutput {
  wantsFloor: boolean;
  grounds: 'direct_attack' | 'new_evidence' | null;
  targetRole: string | null;
  justification: string;
}

export interface JudgePetitionReviewOutput {
  granted: { role: string; reason: string } | null;
  denied: Array<{ role: string; reason: string }>;
}

export interface POCcitation {
  title: string;
  url: string;
  relevance: string;
}

export interface EvidenceItem {
  source: 'github' | 'arxiv' | 'web';
  title: string;
  url: string;
  snippet: string;
}

export interface GeneratedTask {
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2';
  estimate: string;
}

export interface OptionCard {
  id: string; // 'option_a', 'option_b', etc.
  title: string;
  recommended_for: string;
  why_choose: string[];
  why_not_choose: string[];
  poc_citations: POCcitation[];
  generated_tasks: GeneratedTask[];
  agents_md_rules: string[];
}

export interface KeyTension {
  between: [string, string];
  tension: string;
}

export interface JudgeFinalSynthesisOutput {
  debate_summary: string; // 120–250 words
  key_tensions: KeyTension[];
  options: OptionCard[]; // 2–4 options
}

// ============================================================================
// Internal / database-shape types (kept separate from persona contracts)
// ============================================================================

export interface CourtSessionRow {
  id: string;
  room_id: string;
  created_by: string;
  motion: string;
  repo_context: Record<string, unknown>;
  status: 'routing' | 'phase1_opening' | 'phase2_rebuttals' | 'awaiting_human_choice' | 'adopted' | 'failed';
  witness_flags: {
    needsSecurityWitness: boolean;
    needsUxWitness: boolean;
    reasoning: string;
  };
  phase2_grants_used: number;
  debate_summary: string | null;
  key_tensions: Array<{ between: [string, string]; tension: string }>;
  decision_options: OptionCard[];
  adopted_option_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourtTranscriptRow {
  id: string;
  session_id: string;
  phase: 'phase1_opening' | 'judge_gavel' | 'phase2_rebuttal' | 'human_interjection';
  speaker_role: string;
  model_id: string | null;
  content: string;
  citations: Array<{ title: string; url: string; snippet: string }>;
  turn_index: number;
  created_at: string;
}

export interface CourtPetitionRow {
  id: string;
  session_id: string;
  round_number: 1 | 2;
  speaker_role: string;
  wants_floor: boolean;
  grounds: 'direct_attack' | 'new_evidence' | null;
  target_role: string | null;
  justification: string;
  judge_decision: 'pending' | 'granted' | 'denied';
  judge_reason: string | null;
  created_at: string;
}

// ============================================================================
// Persona file name mapping (roles -> personas/ .md filenames)
// ============================================================================

export const PERSONA_FILES: Record<CourtRole, string> = {
  'Clerk Router': 'clerk-router.md',
  'Visionary Counsel': 'counsel-visionary.md',
  'Feasibility Prosecutor': 'prosecutor-logic.md',
  'Architect Counsel': 'counsel-architect.md',
  'Security Witness': 'witness-security.md',
  'UX Witness': 'witness-ux.md',
  'Presiding Judge': 'judge-synthesizer.md',
} as const;
