// ============================================================================
// TrackMyWork - AI Courtroom Demo Mode
// Mock trial engine for when Supabase + NVIDIA NIM are not configured.
// All state lives client-side in React — no API dependency.
// ============================================================================

import type {
  CourtSession,
  OptionCard,
  POCcitation,
  GeneratedTask,
  Transcript,
  Petition,
} from '@/components/room-courtroom-client';

function nowIso(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function transcriptEntry(
  turnIndex: number,
  phase: Transcript['phase'],
  speakerRole: string,
  content: string,
  modelId: string | null,
  citations: POCcitation[] = []
): Transcript {
  return {
    id: id('turn'),
    phase,
    speakerRole,
    content,
    citations,
    turnIndex,
    createdAt: nowIso(),
    modelId,
  };
}

const DEFAULT_OPTIONS: OptionCard[] = [
  {
    id: 'opt_realtime',
    title: 'Adopt Supabase Realtime for the courtroom transcript stream',
    recommended_for: 'Teams wanting live, low-latency courtroom updates',
    why_choose: [
      'Real-time transcript propagation across all participants',
      'Built-in presence and typing indicators',
      'Scales with your existing Supabase project',
    ],
    why_not_choose: [
      'Adds a new infrastructure dependency',
      'Requires schema migrations for court tables',
    ],
    poc_citations: [
      {
        title: 'Supabase Realtime docs',
        url: 'https://supabase.com/docs/guides/realtime',
        relevance: 'Broadcast database changes to clients over WebSocket.',
      },
    ],
    generated_tasks: [
      {
        title: 'Add court_sessions, court_transcripts, court_petitions migrations',
        description: 'Create the Supabase tables needed to persist courtroom state.',
        priority: 'P0',
        estimate: '2h',
      },
      {
        title: 'Wire Supabase Realtime channel into RoomCourtroomClient',
        description: 'Subscribe to court_transcripts and render live speeches.',
        priority: 'P1',
        estimate: '3h',
      },
    ],
    agents_md_rules: [
      'Courtroom transcript updates must be published via Supabase Realtime.',
      'Every speech must include speaker_role, phase, and turn_index.',
    ],
  },
  {
    id: 'opt_polling',
    title: 'Polling fallback with Supabase queries (no Realtime)',
    recommended_for: 'Teams that want to avoid WebSocket infrastructure',
    why_choose: [
      'Works with standard Supabase REST queries only',
      'No additional connection management',
      'Easier to debug and reason about',
    ],
    why_not_choose: [
      'Higher latency (up to 5s poll interval)',
      'More API requests than a WebSocket stream',
    ],
    poc_citations: [
      {
        title: 'Supabase REST API docs',
        url: 'https://supabase.com/docs/guides/api',
        relevance: 'Fetch resources over standard HTTPS.',
      },
    ],
    generated_tasks: [
      {
        title: 'Implement 5-second polling loop in RoomCourtroomClient',
        description: 'Refresh session state every 5 seconds when realtime is unavailable.',
        priority: 'P0',
        estimate: '1h',
      },
      {
        title: 'Add stale-data indicator to the courtroom header',
        description: 'Show users when transcript may be out of date.',
        priority: 'P2',
        estimate: '30m',
      },
    ],
    agents_md_rules: [
      'Courtroom state must be refreshed at least every 5 seconds.',
      'Display a connection status indicator in the courtroom header.',
    ],
  },
];

export interface DemoCourtroomState {
  sessionId: string;
  roomId: string;
  motion: string;
  status: CourtSession['status'];
  createdAt: string;
  updatedAt: string;
  adoptedOptionId: string | null;
  errorMessage: string | null;
  transcripts: Transcript[];
  petitions: Petition[];
  options: OptionCard[];
}

export function createDemoCourtroomState(
  roomId: string,
  motion: string
): DemoCourtroomState {
  const sessionId = id('court');
  const createdAt = nowIso();

  const state: DemoCourtroomState = {
    sessionId,
    roomId,
    motion,
    status: 'routing',
    createdAt,
    updatedAt: createdAt,
    adoptedOptionId: null,
    errorMessage: null,
    transcripts: [],
    petitions: [],
    options: [],
  };

  // Simulate Phase 1: Opening statements after a short delay
  setTimeout(() => {
    state.status = 'phase1_opening';
    state.updatedAt = nowIso();
    state.transcripts = [
      transcriptEntry(
        0,
        'phase1_opening',
        'Courtroom Clerk',
        `Received motion: "${motion}". Convening the AI Courtroom with seven agents: Prosecutor, Feasibility Analyst, Architect, Visionary, Security Reviewer, UX Advocate, and Presiding Judge.`,
        null
      ),
      transcriptEntry(
        1,
        'phase1_opening',
        'Prosecutor',
        `The motion proposes ${motion.toLowerCase()}. This is a significant architectural decision that touches the realtime infrastructure layer. I recommend we proceed with careful evaluation of both options.`,
        'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'
      ),
      transcriptEntry(
        2,
        'phase1_opening',
        'Architect',
        `Supabase Realtime offers native WebSocket broadcasting with presence. The main tradeoff is the new dependency on the Realtime service and the need for court schema migrations.`,
        'nvidia/nemotron-3.5-lightning-30b-a3b'
      ),
    ];
  }, 1500);

  // Simulate Phase 2: Rebuttals, then present options
  setTimeout(() => {
    state.status = 'phase2_rebuttals';
    state.updatedAt = nowIso();
    state.transcripts.push(
      transcriptEntry(
        3,
        'phase2_rebuttal',
        'Visionary',
        `Going with polling means we'll always be behind real-time events. For a courtroom where timing matters—adoption decisions, floor petitions—this creates UX friction.`,
        'poolside/laguna-xs-2.1'
      ),
      transcriptEntry(
        4,
        'phase2_rebuttal',
        'Security Reviewer',
        `Realtime WebSocket connections need careful origin validation and auth checks. Polling is simpler to secure but generates more traffic. Both are viable with proper controls.`,
        null
      ),
      transcriptEntry(
        5,
        'phase2_rebuttal',
        'UX Advocate',
        `Users expect live updates in a collaborative tool. Polling's 5-second delay feels sluggish when teammates are waiting on a ruling.`,
        null
      ),
      transcriptEntry(
        6,
        'phase2_rebuttal',
        'Presiding Judge',
        `Rebuttals complete. The court will now present Option Cards for adoption.`,
        null
      )
    );
    state.options = DEFAULT_OPTIONS.map((o, i) => ({ ...o, id: id(`opt_${i}`) }));
    state.status = 'awaiting_human_choice';
  }, 4000);

  return state;
}

export function adoptDemoOption(
  state: DemoCourtroomState,
  optionId: string
): { ok: boolean; error?: string } {
  if (state.status !== 'awaiting_human_choice') {
    return { ok: false, error: `Cannot adopt: session is ${state.status}.` };
  }
  const option = state.options.find((o) => o.id === optionId);
  if (!option) {
    return { ok: false, error: 'Option not found in this session.' };
  }
  state.status = 'adopted';
  state.adoptedOptionId = optionId;
  state.updatedAt = nowIso();
  state.transcripts.push(
    transcriptEntry(
      state.transcripts.length,
      'judge_gavel',
      'Presiding Judge',
      `✅ Option Adopted: ${option.title}. Created ${option.generated_tasks.length} tasks and synced ${option.agents_md_rules.length} rules to AGENTS.md.`,
      'judge:adopt'
    )
  );
  return { ok: true };
}
