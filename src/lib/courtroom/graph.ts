// ============================================================================
// TrackMyWork - AI Courtroom LangGraph Workflow
// Phase 3: Custom LangGraph.js Two-Phase Courtroom State Machine
// Orchestrates 7 courtroom agents, persists every speech/ruling to Supabase,
// and enforces strict courtroom boundaries against infinite loops.
// ============================================================================

import { StateGraph, END } from '@langchain/langgraph';
import { CourtroomState, type TranscriptEntry, type PendingPetition } from './state';
import type {
  CourtRole,
  EvidenceItem,
  FloorPetitionOutput,
  JudgeFinalSynthesisOutput,
} from './types';
import {
  loadPersonaPrompt,
  buildSpeakerUserPrompt,
  buildJudgePetitionReviewPrompt,
  buildJudgeSynthesisPrompt,
} from './personaLoader';
import {
  invokeCourtroomText,
  invokeCourtroomJson,
} from './nimClient';
import {
  gatherProsecutorEvidence,
  gatherArchitectEvidence,
} from './researchTools';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Supabase admin client (server-side writes)
// ---------------------------------------------------------------------------

const supabaseAdmin = createAdminClient();

// ---------------------------------------------------------------------------
// Helper: format transcript entries as text for prompts
// ---------------------------------------------------------------------------

function formatTranscript(entries: TranscriptEntry[]): string {
  if (entries.length === 0) return '(no speeches yet)';
  return entries
    .map(
      (entry) =>
        `[Turn ${entry.turnIndex}] ${entry.speakerRole} (${entry.phase}): ${entry.content}`
    )
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Helper: insert a transcript row into court_transcripts
// ---------------------------------------------------------------------------

async function insertTranscriptRow({
  sessionId,
  phase,
  speakerRole,
  modelId,
  content,
  citations,
  turnIndex,
}: {
  sessionId: string;
  phase: TranscriptEntry['phase'];
  speakerRole: string;
  modelId: string | null;
  content: string;
  citations: Array<{ title: string; url: string; snippet: string }>;
  turnIndex: number;
}) {
  await supabaseAdmin.from('court_transcripts').insert({
    session_id: sessionId,
    phase,
    speaker_role: speakerRole,
    model_id: modelId,
    content,
    citations,
    turn_index: turnIndex,
  });
}

// ---------------------------------------------------------------------------
// Helper: insert petition rows into court_petitions
// ---------------------------------------------------------------------------

async function insertPetitionRows({
  sessionId,
  roundNumber,
  petitions,
}: {
  sessionId: string;
  roundNumber: number;
  petitions: Array<{
    speaker_role: string;
    wants_floor: boolean;
    grounds: string | null;
    target_role: string | null;
    justification: string;
    judge_decision: 'pending' | 'granted' | 'denied';
    judge_reason: string | null;
  }>;
}) {
  if (petitions.length === 0) return;
  await supabaseAdmin.from('court_petitions').insert(
    petitions.map((p) => ({
      session_id: sessionId,
      round_number: roundNumber,
      speaker_role: p.speaker_role,
      wants_floor: p.wants_floor,
      grounds: p.grounds,
      target_role: p.target_role,
      justification: p.justification,
      judge_decision: p.judge_decision,
      judge_reason: p.judge_reason,
    }))
  );
}

// ---------------------------------------------------------------------------
// Helper: update court_sessions fields
// ---------------------------------------------------------------------------

async function updateCourtSession({
  sessionId,
  updates,
}: {
  sessionId: string;
  updates: Partial<{
    status: string;
    witness_flags: Record<string, unknown>;
    phase2_grants_used: number;
    debate_summary: string | null;
    key_tensions: unknown[];
    decision_options: unknown[];
    adopted_option_id: string | null;
    error_message: string | null;
  }>;
}) {
  await supabaseAdmin
    .from('court_sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

// ---------------------------------------------------------------------------
// Node 1: clerk_triage
// ---------------------------------------------------------------------------

async function clerkTriage(state: typeof CourtroomState.State) {
  // Mark session as routing
  await updateCourtSession({
    sessionId: state.sessionId,
    updates: { status: 'routing' },
  });

  // Load Clerk Router persona and classify the motion
  const systemPrompt = await loadPersonaPrompt('Clerk Router');
  const userPrompt = buildSpeakerUserPrompt({
    mode: 'routing',
    motion: state.motion,
    transcript: '',
    repoContext: state.repoContext,
  });

  const result = await invokeCourtroomJson<{
    needsSecurityWitness: boolean;
    needsUxWitness: boolean;
    reasoning: string;
  }>({
    role: 'Clerk Router',
    systemPrompt,
    userPrompt,
    maxTokens: 120,
  });

  const witnessFlags = result.data;

  // Build active speakers in strict order
  const activeSpeakers: CourtRole[] = [
    'Visionary Counsel',
    'Feasibility Prosecutor',
    'Architect Counsel',
  ];
  if (witnessFlags.needsSecurityWitness) {
    activeSpeakers.push('Security Witness');
  }
  if (witnessFlags.needsUxWitness) {
    activeSpeakers.push('UX Witness');
  }

  // Save witness_flags to court_sessions
  await updateCourtSession({
    sessionId: state.sessionId,
    updates: {
      witness_flags: witnessFlags,
      phase2_grants_used: state.phase2GrantsUsed,
    },
  });

  return {
    witnessFlags,
    activeSpeakers,
    stepCount: state.stepCount + 1,
  };
}

// ---------------------------------------------------------------------------
// Node 2: phase1_opening_statements
// ---------------------------------------------------------------------------

async function phase1OpeningStatements(state: typeof CourtroomState.State) {
  await updateCourtSession({
    sessionId: state.sessionId,
    updates: { status: 'phase1_opening' },
  });

  const transcript: TranscriptEntry[] = [];
  let turnIndex = 0;

  for (const role of state.activeSpeakers) {
    const personaPrompt = await loadPersonaPrompt(role);

    // Build evidence context for specific roles
    let evidenceStr = '';
    if (role === 'Feasibility Prosecutor') {
      const evidence = await gatherProsecutorEvidence(state.motion);
      if (evidence.length > 0) {
        evidenceStr = evidence
          .map((e) => `[${e.source.toUpperCase()}] ${e.title}: ${e.snippet} (${e.url})`)
          .join('\n');
      }
    } else if (role === 'Architect Counsel') {
      // Gather architect evidence, using prior prosecutor opening text if available
      const prosecutorOpening = transcript.find((t) => t.speakerRole === 'Feasibility Prosecutor');
      const prosecutorObjections = prosecutorOpening
        ? `Prior Prosecutor opening stated: "${prosecutorOpening.content.slice(0, 200)}..."`
        : undefined;
      const evidence = await gatherArchitectEvidence(state.motion, prosecutorObjections);
      if (evidence.length > 0) {
        evidenceStr = evidence
          .map((e) => `[${e.source.toUpperCase()}] ${e.title}: ${e.snippet} (${e.url})`)
          .join('\n');
      }
    }

    const userPrompt = buildSpeakerUserPrompt({
      mode: 'opening',
      motion: state.motion,
      transcript: formatTranscript(transcript),
      evidence: evidenceStr || undefined,
      repoContext: state.repoContext,
    });

    const speech = await invokeCourtroomText({
      role,
      systemPrompt: personaPrompt,
      userPrompt,
      maxTokens: 750,
      temperature: 0.3,
    });

    const entry: TranscriptEntry = {
      phase: 'phase1_opening',
      speakerRole: role,
      modelId: speech.modelUsed,
      content: speech.text,
      citations: [],
      turnIndex,
    };

    // Insert into Supabase immediately for live Realtime delivery
    await insertTranscriptRow({
      sessionId: state.sessionId,
      phase: 'phase1_opening',
      speakerRole: role,
      modelId: speech.modelUsed,
      content: speech.text,
      citations: [],
      turnIndex,
    });

    transcript.push(entry);
    turnIndex++;
  }

  return {
    transcript,
    stepCount: state.stepCount + 1,
  };
}

// ---------------------------------------------------------------------------
// Node 3: phase2_collect_petitions
// ---------------------------------------------------------------------------

async function phase2CollectPetitions(state: typeof CourtroomState.State) {
  await updateCourtSession({
    sessionId: state.sessionId,
    updates: { status: 'phase2_rebuttals' },
  });

  // Hard boundary check
  if (state.phase2GrantsUsed >= state.maxPhase2Grants || state.stepCount >= 18) {
    return {
      pendingPetitions: [],
      stepCount: state.stepCount + 1,
    };
  }

  // Query all active speakers in parallel for floor petitions
  const petitionResults = await Promise.allSettled(
    state.activeSpeakers.map(async (role: CourtRole) => {
      const personaPrompt = await loadPersonaPrompt(role);
      const userPrompt = buildSpeakerUserPrompt({
        mode: 'petition',
        motion: state.motion,
        transcript: formatTranscript(state.transcript),
        repoContext: state.repoContext,
      });

      const result = await invokeCourtroomJson<{
        wantsFloor: boolean;
        grounds: 'direct_attack' | 'new_evidence' | null;
        targetRole: string | null;
        justification: string;
      }>({
        role,
        systemPrompt: personaPrompt,
        userPrompt,
        maxTokens: 120,
      });

      return { role, petition: result.data };
    })
  );

  const pendingPetitions: PendingPetition[] = [];
  for (const result of petitionResults) {
    if (result.status === 'fulfilled') {
      pendingPetitions.push(result.value);
    }
  }

  return {
    pendingPetitions,
    stepCount: state.stepCount + 1,
  };
}

// ---------------------------------------------------------------------------
// Node 4: judge_petition_review
// ---------------------------------------------------------------------------

async function judgePetitionReview(state: typeof CourtroomState.State) {
  const roundNumber = state.phase2GrantsUsed + 1;

  // If no one wants the floor, close early
  const wantsFloor = state.pendingPetitions.some((p) => p.petition.wantsFloor);
  if (!wantsFloor) {
    return {
      grantedSpeaker: null as CourtRole | null,
      lastJudgeGavelReason: 'No agent requested the floor. Phase 2 closed early.',
      stepCount: state.stepCount + 1,
    };
  }

  // Call Presiding Judge to review petitions
  const personaPrompt = await loadPersonaPrompt('Presiding Judge');
  const userPrompt = buildJudgePetitionReviewPrompt({
    mode: 'petition_review',
    motion: state.motion,
    transcript: formatTranscript(state.transcript),
    petitions: state.pendingPetitions.map((p) => ({
      speaker_role: p.role,
      wants_floor: p.petition.wantsFloor,
      grounds: p.petition.grounds,
      target_role: p.petition.targetRole,
      justification: p.petition.justification,
    })),
    phase2State: {
      phase2_grants_used: state.phase2GrantsUsed,
      round_number: roundNumber,
    },
  });

  const review = await invokeCourtroomJson<{
    granted: { role: string; reason: string } | null;
    denied: Array<{ role: string; reason: string }>;
  }>({
    role: 'Presiding Judge',
    systemPrompt: personaPrompt,
    userPrompt,
    maxTokens: 250,
  });

  // Insert all petitions into court_petitions
  const petitionRows = state.pendingPetitions.map((p) => ({
    speaker_role: p.role,
    wants_floor: p.petition.wantsFloor,
    grounds: p.petition.grounds,
    target_role: p.petition.targetRole,
    justification: p.petition.justification,
    judge_decision: 'pending' as const,
    judge_reason: null as string | null,
  }));

  await insertPetitionRows({
    sessionId: state.sessionId,
    roundNumber,
    petitions: petitionRows,
  });

  // Hard-enforce boundary in TypeScript
  let grantedSpeaker: CourtRole | null = null;
  let gavelReason = '';

  if (review.data.granted) {
    const grantedRole = review.data.granted.role as CourtRole;
    const alreadyHeard = state.phase2HeardRoles.includes(grantedRole);
    const grantsExceeded = state.phase2GrantsUsed + 1 > state.maxPhase2Grants;

    if (!alreadyHeard && !grantsExceeded) {
      grantedSpeaker = grantedRole;
      gavelReason = review.data.granted.reason;
    } else {
      gavelReason = `Judge requested ${grantedRole} but boundary enforced: already heard or grant limit reached.`;
    }
  }

  // Update petition decisions in Supabase (mark granted/denied)
  const { data: petitionRowsDb } = await supabaseAdmin
    .from('court_petitions')
    .select('id, speaker_role')
    .eq('session_id', state.sessionId)
    .eq('round_number', roundNumber);

  if (petitionRowsDb) {
    const updates = petitionRowsDb.map((row) => {
      const isGranted = grantedSpeaker !== null && row.speaker_role === grantedSpeaker;
      return {
        id: row.id,
        judge_decision: isGranted ? 'granted' : 'denied',
        judge_reason: isGranted ? gavelReason : 'Floor not granted by the Presiding Judge.',
      };
    });
    await supabaseAdmin.from('court_petitions').upsert(updates);
  }

  // Insert Judge gavel announcement if floor granted
  if (grantedSpeaker !== null) {
    await insertTranscriptRow({
      sessionId: state.sessionId,
      phase: 'judge_gavel',
      speakerRole: 'Presiding Judge',
      modelId: 'nvidia/nemotron-3-ultra-550b-a55b',
      content: `⚖️ The Court grants the floor to ${grantedSpeaker} for Rebuttal ${roundNumber}/${state.maxPhase2Grants}: ${gavelReason}`,
      citations: [],
      turnIndex: state.transcript.length,
    });
  }

  return {
    grantedSpeaker,
    lastJudgeGavelReason: gavelReason,
    stepCount: state.stepCount + 1,
  };
}

// ---------------------------------------------------------------------------
// Node 5: phase2_deliver_rebuttal
// ---------------------------------------------------------------------------

async function phase2DeliverRebuttal(state: typeof CourtroomState.State) {
  if (!state.grantedSpeaker) {
    return {};
  }

  const role = state.grantedSpeaker;

  // Optionally fetch fresh evidence for Prosecutor/Architect rebuttals
  let evidenceStr = '';
  if (role === 'Feasibility Prosecutor') {
    const evidence = await gatherProsecutorEvidence(state.motion);
    if (evidence.length > 0) {
      evidenceStr = evidence
        .map((e) => `[${e.source.toUpperCase()}] ${e.title}: ${e.snippet} (${e.url})`)
        .join('\n');
    }
  } else if (role === 'Architect Counsel') {
    const evidence = await gatherArchitectEvidence(state.motion);
    if (evidence.length > 0) {
      evidenceStr = evidence
        .map((e) => `[${e.source.toUpperCase()}] ${e.title}: ${e.snippet} (${e.url})`)
        .join('\n');
    }
  }

  const personaPrompt = await loadPersonaPrompt(role);
  const userPrompt = buildSpeakerUserPrompt({
    mode: 'rebuttal',
    motion: state.motion,
    transcript: formatTranscript(state.transcript),
    evidence: evidenceStr || undefined,
    repoContext: state.repoContext,
  });

  const speech = await invokeCourtroomText({
    role,
    systemPrompt: personaPrompt,
    userPrompt,
    maxTokens: 750,
    temperature: 0.3,
  });

  const entry: TranscriptEntry = {
    phase: 'phase2_rebuttal',
    speakerRole: role,
    modelId: speech.modelUsed,
    content: speech.text,
    citations: [],
    turnIndex: state.transcript.length + 1,
  };

  // Insert rebuttal into Supabase
  await insertTranscriptRow({
    sessionId: state.sessionId,
    phase: 'phase2_rebuttal',
    speakerRole: role,
    modelId: speech.modelUsed,
    content: speech.text,
    citations: [],
    turnIndex: entry.turnIndex,
  });

  // Update court_sessions: increment grants used
  await updateCourtSession({
    sessionId: state.sessionId,
    updates: {
      phase2_grants_used: state.phase2GrantsUsed + 1,
    },
  });

  return {
    transcript: [entry],
    phase2GrantsUsed: state.phase2GrantsUsed + 1,
    phase2HeardRoles: [role],
    grantedSpeaker: null as CourtRole | null, // reset after delivering
    stepCount: state.stepCount + 1,
  };
}

// ---------------------------------------------------------------------------
// Node 6: judge_final_synthesis
// ---------------------------------------------------------------------------

async function judgeFinalSynthesis(state: typeof CourtroomState.State) {
  try {
    // Pull human interjections from Supabase right before synthesizing
    const { data: interjections } = await supabaseAdmin
      .from('court_transcripts')
      .select('speaker_role, content, created_at')
      .eq('session_id', state.sessionId)
      .eq('phase', 'human_interjection')
      .order('created_at', { ascending: true });

    let interjectionText = '';
    if (interjections && interjections.length > 0) {
      interjectionText = interjections
        .map((i) => `[Human] ${i.speaker_role}: ${i.content}`)
        .join('\n');
    }

    // Build full transcript including interjections
    const fullTranscript = formatTranscript(state.transcript);
    const combinedTranscript =
      interjectionText.length > 0
        ? `${fullTranscript}\n\nHuman Interjections:\n${interjectionText}`
        : fullTranscript;

    const personaPrompt = await loadPersonaPrompt('Presiding Judge');
    const userPrompt = buildJudgeSynthesisPrompt({
      mode: 'final_synthesis',
      motion: state.motion,
      transcript: combinedTranscript,
      repoContext: state.repoContext,
      petitions: state.pendingPetitions.map((p) => ({
        speaker_role: p.role,
        wants_floor: p.petition.wantsFloor,
        grounds: p.petition.grounds,
        target_role: p.petition.targetRole,
        justification: p.petition.justification,
        judge_decision: state.grantedSpeaker === p.role ? 'granted' : 'denied',
        judge_reason: state.lastJudgeGavelReason || null,
      })),
      phase2State: {
        phase2_grants_used: state.phase2GrantsUsed,
        round_number: state.phase2GrantsUsed + 1,
      },
    });

    const synthesis = await invokeCourtroomJson<{
      debate_summary: string;
      key_tensions: Array<{ between: [string, string]; tension: string }>;
      options: Array<{
        id: string;
        title: string;
        recommended_for: string;
        why_choose: string[];
        why_not_choose: string[];
        poc_citations: Array<{ title: string; url: string; relevance: string }>;
        generated_tasks: Array<{
          title: string;
          description: string;
          priority: 'P0' | 'P1' | 'P2';
          estimate: string;
        }>;
        agents_md_rules: string[];
      }>;
    }>({
      role: 'Presiding Judge',
      systemPrompt: personaPrompt,
      userPrompt,
      maxTokens: 1600,
    });

    // Update court_sessions with synthesis results
    await updateCourtSession({
      sessionId: state.sessionId,
      updates: {
        status: 'awaiting_human_choice',
        debate_summary: synthesis.data.debate_summary,
        key_tensions: synthesis.data.key_tensions,
        decision_options: synthesis.data.options,
      },
    });

    return {
      finalSynthesis: synthesis.data as JudgeFinalSynthesisOutput,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    // Unrecoverable error — mark session as failed so UI never hangs
    await updateCourtSession({
      sessionId: state.sessionId,
      updates: {
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
      },
    });
    return {
      finalSynthesis: null,
      stepCount: state.stepCount + 1,
    };
  }
}

// ---------------------------------------------------------------------------
// Conditional edge: after judge_petition_review
// ---------------------------------------------------------------------------

function afterPetitionReview(state: typeof CourtroomState.State) {
  // Hard boundary: step limit reached
  if (state.stepCount >= 18) {
    return 'judge_final_synthesis';
  }
  // If a speaker was granted the floor, deliver rebuttal
  if (state.grantedSpeaker !== null) {
    return 'phase2_deliver_rebuttal';
  }
  // Otherwise go straight to final synthesis
  return 'judge_final_synthesis';
}

// ---------------------------------------------------------------------------
// Conditional edge: after phase2_deliver_rebuttal
// ---------------------------------------------------------------------------

function afterRebuttal(state: typeof CourtroomState.State) {
  // Hard boundary: step limit or grant limit reached
  if (state.stepCount >= 18 || state.phase2GrantsUsed >= state.maxPhase2Grants) {
    return 'judge_final_synthesis';
  }
  // Loop back to collect more petitions
  return 'phase2_collect_petitions';
}

// ---------------------------------------------------------------------------
// Build the StateGraph
// ---------------------------------------------------------------------------

const courtroomGraph = new StateGraph(CourtroomState)
  .addNode('clerk_triage', clerkTriage)
  .addNode('phase1_opening_statements', phase1OpeningStatements)
  .addNode('phase2_collect_petitions', phase2CollectPetitions)
  .addNode('judge_petition_review', judgePetitionReview)
  .addNode('phase2_deliver_rebuttal', phase2DeliverRebuttal)
  .addNode('judge_final_synthesis', judgeFinalSynthesis)
  .addEdge('__start__', 'clerk_triage')
  .addEdge('clerk_triage', 'phase1_opening_statements')
  .addEdge('phase1_opening_statements', 'phase2_collect_petitions')
  .addEdge('phase2_collect_petitions', 'judge_petition_review')
  .addConditionalEdges('judge_petition_review', afterPetitionReview, {
    phase2_deliver_rebuttal: 'phase2_deliver_rebuttal',
    judge_final_synthesis: 'judge_final_synthesis',
  })
  .addConditionalEdges('phase2_deliver_rebuttal', afterRebuttal, {
    phase2_collect_petitions: 'phase2_collect_petitions',
    judge_final_synthesis: 'judge_final_synthesis',
  })
  .addEdge('judge_final_synthesis', END);

export const courtroomApp = courtroomGraph.compile();

// ---------------------------------------------------------------------------
// Exported entry point
// ---------------------------------------------------------------------------

export interface RunCourtroomSessionParams {
  sessionId: string;
  roomId: string;
  motion: string;
  repoContext?: Record<string, unknown>;
  fastDemoMode?: boolean;
}

export async function runCourtroomSession(params: RunCourtroomSessionParams): Promise<JudgeFinalSynthesisOutput | null> {
  const initialState = {
    sessionId: params.sessionId,
    roomId: params.roomId,
    motion: params.motion,
    repoContext: params.repoContext ?? {},
    fastDemoMode: params.fastDemoMode ?? false,
    maxPhase2Grants: params.fastDemoMode ? 1 : 2,
    stepCount: 0,
  } as Partial<typeof CourtroomState.State> & Record<string, unknown>;

  const result = await courtroomApp.invoke(initialState);

  return result.finalSynthesis ?? null;
}
