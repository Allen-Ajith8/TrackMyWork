// ============================================================================
// TrackMyWork - AI Courtroom State Annotation
// Phase 3: LangGraph.js CourtroomState tracking all fields required by the
// two-phase courtroom state machine.
// ============================================================================

import { Annotation } from '@langchain/langgraph';
import type {
  ClerkRouterOutput,
  CourtRole,
  EvidenceItem,
  FloorPetitionOutput,
  JudgeFinalSynthesisOutput,
} from './types';

// ---------------------------------------------------------------------------
// Transcript entry shape
// ---------------------------------------------------------------------------

export interface TranscriptEntry {
  phase: 'phase1_opening' | 'judge_gavel' | 'phase2_rebuttal' | 'human_interjection';
  speakerRole: string;
  modelId: string | null;
  content: string;
  citations: Array<{ title: string; url: string; snippet: string }>;
  turnIndex: number;
}

// ---------------------------------------------------------------------------
// Pending petition shape
// ---------------------------------------------------------------------------

export interface PendingPetition {
  role: CourtRole;
  petition: FloorPetitionOutput;
}

// ---------------------------------------------------------------------------
// CourtroomState Annotation
// ---------------------------------------------------------------------------

export const CourtroomState = Annotation.Root({
  sessionId: Annotation<string>,

  roomId: Annotation<string>,

  motion: Annotation<string>,

  repoContext: Annotation<Record<string, unknown>>,

  fastDemoMode: Annotation<boolean>,

  witnessFlags: Annotation<ClerkRouterOutput>,

  activeSpeakers: Annotation<CourtRole[]>,

  transcript: Annotation<TranscriptEntry[]>({
    reducer: (left: TranscriptEntry[], right: TranscriptEntry[]) => [...left, ...right],
    default: () => [],
  }),

  prosecutorEvidence: Annotation<EvidenceItem[]>({
    reducer: (left: EvidenceItem[], right: EvidenceItem[]) => [...left, ...right],
    default: () => [],
  }),

  architectEvidence: Annotation<EvidenceItem[]>({
    reducer: (left: EvidenceItem[], right: EvidenceItem[]) => [...left, ...right],
    default: () => [],
  }),

  phase2GrantsUsed: Annotation<number>,

  maxPhase2Grants: Annotation<number>,

  phase2HeardRoles: Annotation<CourtRole[]>({
    reducer: (left: CourtRole[], right: CourtRole[]) => [...left, ...right],
    default: () => [],
  }),

  pendingPetitions: Annotation<Array<PendingPetition>>,

  grantedSpeaker: Annotation<CourtRole | null>,

  lastJudgeGavelReason: Annotation<string>,

  finalSynthesis: Annotation<JudgeFinalSynthesisOutput | null>,

  stepCount: Annotation<number>,
});

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

export interface InitialCourtroomStateParams {
  sessionId: string;
  roomId: string;
  motion: string;
  repoContext: Record<string, unknown>;
  fastDemoMode?: boolean;
}

export function createInitialCourtroomState(params: InitialCourtroomStateParams) {
  return {
    sessionId: params.sessionId,
    roomId: params.roomId,
    motion: params.motion,
    repoContext: params.repoContext,
    fastDemoMode: params.fastDemoMode ?? false,
    maxPhase2Grants: params.fastDemoMode ? 1 : 2,
    stepCount: 0,
  };
}
