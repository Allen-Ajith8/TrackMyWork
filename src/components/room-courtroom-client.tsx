'use client';

// ============================================================================
// TrackMyWork - AI Courtroom Workspace (Phase 5)
// Live courtroom UI: docket launcher, Realtime transcript stream, floor
// petitions, human bench interjections, and the Judge's Option Card matrix.
// ============================================================================

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Gavel,
  Github,
  Landmark,
  Loader2,
  Lock,
  MessageSquare,
  Radio,
  RefreshCw,
  Scale,
  ScrollText,
  Send,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  createDemoCourtroomState,
  adoptDemoOption,
  type DemoCourtroomState,
} from '@/lib/courtroom/demo';

// ---------------------------------------------------------------------------
// Types (mirroring the Phase 4 API contract)
// ---------------------------------------------------------------------------

type SessionStatus =
  | 'routing'
  | 'phase1_opening'
  | 'phase2_rebuttals'
  | 'awaiting_human_choice'
  | 'adopted'
  | 'failed';

interface CourtSessionSummary {
  id: string;
  motion: string;
  status: SessionStatus;
  created_at: string;
  adopted_option_id: string | null;
}

interface KeyTension {
  between: [string, string];
  tension: string;
}

export interface POCcitation {
  title: string;
  url: string;
  relevance: string;
}

export interface GeneratedTask {
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2';
  estimate: string;
}

export interface OptionCard {
  id: string;
  title: string;
  recommended_for: string;
  why_choose: string[];
  why_not_choose: string[];
  poc_citations: POCcitation[];
  generated_tasks: GeneratedTask[];
  agents_md_rules: string[];
}

export interface CourtSession {
  id: string;
  room_id: string;
  created_by: string;
  motion: string;
  repo_context: Record<string, unknown>;
  status: SessionStatus;
  witness_flags: {
    needsSecurityWitness?: boolean;
    needsUxWitness?: boolean;
    reasoning?: string;
  } | null;
  phase2_grants_used: number;
  debate_summary: string | null;
  key_tensions: KeyTension[];
  decision_options: OptionCard[];
  adopted_option_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: string;
  phase: 'phase1_opening' | 'judge_gavel' | 'phase2_rebuttal' | 'human_interjection';
  speakerRole: string;
  modelId: string | null;
  content: string;
  citations: POCcitation[];
  turnIndex: number;
  createdAt: string;
}

export interface Petition {
  id: string;
  roundNumber: number;
  speakerRole: string;
  wantsFloor: boolean;
  grounds: 'direct_attack' | 'new_evidence' | null;
  targetRole: string | null;
  justification: string;
  judgeDecision: 'pending' | 'granted' | 'denied';
  judgeReason: string | null;
  createdAt: string;
}

interface RoomCourtroomClientProps {
  room: { id: string; name: string; description?: string | null };
  currentUserId: string;
  initialSessions: CourtSessionSummary[];
  demoMode?: boolean;
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES: SessionStatus[] = ['routing', 'phase1_opening', 'phase2_rebuttals'];

const PHASE_STEPS: Array<{ key: string; label: string; statuses: SessionStatus[] }> = [
  { key: 'clerk', label: 'Clerk Triage', statuses: ['routing'] },
  { key: 'phase1', label: 'Phase 1: Opening Statements', statuses: ['phase1_opening'] },
  { key: 'phase2', label: 'Phase 2: Floor Petitions & Rebuttals', statuses: ['phase2_rebuttals'] },
  { key: 'decision', label: 'Phase 3: Human Decision', statuses: ['awaiting_human_choice'] },
  { key: 'adopted', label: 'Adopted', statuses: ['adopted'] },
];

function statusToStepIndex(status: SessionStatus): number {
  if (status === 'failed') return -1;
  const idx = PHASE_STEPS.findIndex((step) => step.statuses.includes(status));
  return idx === -1 ? 0 : idx;
}

function statusLabel(status: SessionStatus): string {
  switch (status) {
    case 'routing':
      return 'Clerk Triage';
    case 'phase1_opening':
      return 'Phase 1: Opening Statements';
    case 'phase2_rebuttals':
      return 'Phase 2: Floor Petitions & Rebuttals';
    case 'awaiting_human_choice':
      return 'Phase 3: Human Decision';
    case 'adopted':
      return 'Adopted';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

function roleBadgeClass(role: string): string {
  const key = role.toLowerCase();
  if (key.includes('judge')) return 'border-amber-300 bg-amber-50 text-amber-800';
  if (key.includes('prosecutor') || key.includes('feasibility'))
    return 'border-rose-300 bg-rose-50 text-rose-700';
  if (key.includes('architect')) return 'border-sky-300 bg-sky-50 text-sky-700';
  if (key.includes('visionary')) return 'border-violet-300 bg-violet-50 text-violet-700';
  if (key.includes('security')) return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (key.includes('ux')) return 'border-pink-300 bg-pink-50 text-pink-700';
  if (key.includes('human')) return 'border-indigo-300 bg-indigo-50 text-indigo-700';
  return 'border-slate-300 bg-slate-50 text-slate-700';
}

function phaseLabel(phase: Transcript['phase']): string {
  switch (phase) {
    case 'phase1_opening':
      return 'Opening';
    case 'judge_gavel':
      return 'Judge Gavel';
    case 'phase2_rebuttal':
      return 'Rebuttal';
    case 'human_interjection':
      return 'Human Interjection';
    default:
      return phase;
  }
}

function priorityBadge(priority: GeneratedTask['priority']): string {
  switch (priority) {
    case 'P0':
      return 'border-rose-300 bg-rose-50 text-rose-700';
    case 'P1':
      return 'border-amber-300 bg-amber-50 text-amber-800';
    default:
      return 'border-sky-300 bg-sky-50 text-sky-700';
  }
}

function citationIcon(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes('github')) return Github;
  if (lower.includes('arxiv')) return ScrollText;
  return ExternalLink;
}

/** Lightweight markdown-ish renderer for model prose (no extra dependency). */
function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={`${keyPrefix}-${index}`}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.8em] text-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>;
  });
}

function SpeechContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
        {bullets.map((bullet, index) => (
          <li key={`li-${blocks.length}-${index}`}>
            {renderInline(bullet, `li-${blocks.length}-${index}`)}
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      return;
    }
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, ''));
      return;
    }
    flushBullets();
    if (line.startsWith('#')) {
      blocks.push(
        <p key={`h-${index}`} className="mb-1 mt-2 font-semibold text-slate-900 first:mt-0">
          {renderInline(line.replace(/^#+\s*/, ''), `h-${index}`)}
        </p>
      );
      return;
    }
    blocks.push(
      <p key={`p-${index}`} className="mb-2 last:mb-0">
        {renderInline(line, `p-${index}`)}
      </p>
    );
  });

  flushBullets();

  return <div className="text-sm leading-relaxed text-slate-700">{blocks}</div>;
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function PhaseStepper({ status }: { status: SessionStatus }) {
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        <AlertTriangle className="h-4 w-4" />
        <span className="font-medium">Trial failed.</span>
        <span className="text-rose-600">Check the error below and start a new docket.</span>
      </div>
    );
  }

  const current = statusToStepIndex(status);

  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {PHASE_STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step.key} className="flex items-center gap-1">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  done && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  active && 'border-primary-300 bg-primary-50 text-primary-700 shadow-sm',
                  !done && !active && 'border-slate-200 bg-white text-slate-400'
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px]">
                    {index + 1}
                  </span>
                )}
                {step.label}
              </div>
              {index < PHASE_STEPS.length - 1 && (
                <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function WitnessBadges({ session }: { session: CourtSession }) {
  const security = Boolean(session.witness_flags?.needsSecurityWitness);
  const ux = Boolean(session.witness_flags?.needsUxWitness);

  if (!security && !ux) {
    return (
      <Badge variant="outline" className="border-slate-200 bg-white text-slate-500">
        No witnesses summoned
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {security && (
        <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700">
          <Shield className="h-3 w-3" />
          Security Witness Summoned
        </Badge>
      )}
      {ux && (
        <Badge variant="outline" className="gap-1 border-pink-300 bg-pink-50 text-pink-700">
          <Users className="h-3 w-3" />
          UX Witness Summoned
        </Badge>
      )}
    </div>
  );
}

function CitationPills({
  citations,
}: {
  citations: Array<{ title: string; url: string; snippet?: string; relevance?: string }>;
}) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {citations.map((citation, index) => {
        const Icon = citationIcon(citation.url);
        return (
          <a
            key={`${citation.url}-${index}`}
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            title={citation.snippet || citation.relevance || citation.title}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-700"
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{citation.title}</span>
          </a>
        );
      })}
    </div>
  );
}

function SpeakerCard({ entry }: { entry: Transcript }) {
  const isHuman = entry.phase === 'human_interjection';
  const isJudge = entry.speakerRole.toLowerCase().includes('judge');
  const modelLabel = entry.modelId?.startsWith('human:')
    ? entry.modelId.slice('human:'.length)
    : entry.modelId;

  return (
    <Card
      className={cn(
        'border-slate-200 shadow-sm',
        isHuman && 'border-indigo-200 bg-indigo-50/40',
        isJudge && 'border-amber-200 bg-amber-50/30'
      )}
    >
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn('font-semibold', roleBadgeClass(entry.speakerRole))}>
            {entry.speakerRole}
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-500">
            {phaseLabel(entry.phase)}
          </Badge>
          {modelLabel && (
            <span className="rounded-full bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-100">
              {modelLabel}
            </span>
          )}
          <span className="ml-auto text-[11px] text-slate-400">#{entry.turnIndex + 1}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <SpeechContent content={entry.content} />
        <CitationPills citations={entry.citations ?? []} />
      </CardContent>
    </Card>
  );
}

function PetitionRow({ petition }: { petition: Petition }) {
  const granted = petition.judgeDecision === 'granted';
  const denied = petition.judgeDecision === 'denied';

  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-sm',
        granted && 'border-emerald-200 bg-emerald-50/60',
        denied && 'border-amber-200 bg-amber-50/50',
        !granted && !denied && 'border-slate-200 bg-white'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-slate-200 bg-white text-slate-500">
          Round {petition.roundNumber}
        </Badge>
        <span className="font-medium text-slate-800">{petition.speakerRole}</span>
        <Badge
          variant="outline"
          className={cn(
            'font-semibold',
            granted && 'border-emerald-300 bg-emerald-100 text-emerald-800',
            denied && 'border-amber-300 bg-amber-100 text-amber-800',
            !granted && !denied && 'border-slate-300 bg-slate-100 text-slate-600'
          )}
        >
          {petition.judgeDecision.toUpperCase()}
        </Badge>
        {petition.grounds && (
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            {petition.grounds.replace('_', ' ')}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-slate-600">{petition.justification}</p>
      {petition.judgeReason && (
        <p className="mt-1 text-xs italic text-slate-500">Judge: {petition.judgeReason}</p>
      )}
    </div>
  );
}

function OptionCardView({
  option,
  adopted,
  adopting,
  disabled,
  onAdopt,
}: {
  option: OptionCard;
  adopted: boolean;
  adopting: boolean;
  disabled: boolean;
  onAdopt: () => void;
}) {
  return (
    <Card
      className={cn(
        'flex flex-col border-slate-200 shadow-sm transition-shadow',
        adopted && 'border-emerald-400 shadow-md ring-1 ring-emerald-200'
      )}
    >
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg leading-snug">{option.title}</CardTitle>
          {adopted && (
            <Badge variant="outline" className="shrink-0 border-emerald-300 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Adopted
            </Badge>
          )}
        </div>
        <Badge variant="outline" className="w-fit border-primary-200 bg-primary-50 text-primary-700">
          <Sparkles className="mr-1 h-3 w-3" />
          Recommended for: {option.recommended_for}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              <ThumbsUp className="h-3.5 w-3.5" />
              Why Choose This
            </p>
            <ul className="space-y-1.5">
              {(option.why_choose ?? []).map((reason, index) => (
                <li key={index} className="flex gap-1.5 text-xs leading-relaxed text-emerald-900">
                  <Check className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
              <ThumbsDown className="h-3.5 w-3.5" />
              Why Not Choose This
            </p>
            <ul className="space-y-1.5">
              {(option.why_not_choose ?? []).map((reason, index) => (
                <li key={index} className="flex gap-1.5 text-xs leading-relaxed text-rose-900">
                  <X className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <CitationPills citations={option.poc_citations ?? []} />

        <div className="space-y-2">
          <details className="group rounded-lg border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700">
              <span>Generated Tasks ({option.generated_tasks?.length ?? 0})</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-slate-100 p-3">
              {(option.generated_tasks ?? []).map((task, index) => (
                <div key={index} className="rounded-md bg-slate-50 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn('text-[10px]', priorityBadge(task.priority))}>
                      {task.priority}
                    </Badge>
                    <span className="text-xs font-medium text-slate-800">{task.title}</span>
                    {task.estimate && (
                      <span className="ml-auto text-[10px] text-slate-400">{task.estimate}</span>
                    )}
                  </div>
                  {task.description && (
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{task.description}</p>
                  )}
                </div>
              ))}
            </div>
          </details>

          <details className="group rounded-lg border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700">
              <span>AGENTS.md Rules ({option.agents_md_rules?.length ?? 0})</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="space-y-1.5 border-t border-slate-100 p-3">
              {(option.agents_md_rules ?? []).map((rule, index) => (
                <li key={index} className="flex gap-1.5 text-[11px] leading-relaxed text-slate-600">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>

        <Button
          className="mt-auto w-full"
          variant={adopted ? 'outline' : 'default'}
          disabled={disabled || adopting || adopted}
          onClick={onAdopt}
        >
          {adopting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adopting…
            </>
          ) : adopted ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Adopted — Tasks & MCP Synced
            </>
          ) : (
            <>
              <Gavel className="mr-2 h-4 w-4" />
              Adopt Option &amp; Sync to Tasks / MCP
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RoomCourtroomClient({
  room,
  currentUserId,
  initialSessions,
  demoMode = false,
}: RoomCourtroomClientProps) {
  const [sessions, setSessions] = React.useState<CourtSessionSummary[]>(initialSessions);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(
    initialSessions[0]?.id ?? null
  );
  const [session, setSession] = React.useState<CourtSession | null>(null);
  const [transcripts, setTranscripts] = React.useState<Transcript[]>([]);
  const [petitions, setPetitions] = React.useState<Petition[]>([]);
  const [demoState, setDemoState] = React.useState<DemoCourtroomState | null>(null);
  const [hydrating, setHydrating] = React.useState(false);
  const [realtimeState, setRealtimeState] = React.useState<'connecting' | 'live' | 'polling'>(
    demoMode ? 'live' : 'connecting'
  );

  // Docket launcher state
  const [launcherOpen, setLauncherOpen] = React.useState(
    demoMode || initialSessions.length === 0
  );
  const [motion, setMotion] = React.useState('');
  const [repoContextText, setRepoContextText] = React.useState('');
  const [fastDemoMode, setFastDemoMode] = React.useState(true);
  const [starting, setStarting] = React.useState(false);
  const [launcherError, setLauncherError] = React.useState<string | null>(null);

  // Interjection state
  const [interjection, setInterjection] = React.useState('');
  const [posting, setPosting] = React.useState(false);

  // Adoption state
  const [adoptingOptionId, setAdoptingOptionId] = React.useState<string | null>(null);

  // Notifications
  const [notice, setNotice] = React.useState<{ tone: 'success' | 'error'; text: string } | null>(
    null
  );

  const transcriptEndRef = React.useRef<HTMLDivElement | null>(null);
  const lastTurnRef = React.useRef<number>(-1);

  const showNotice = React.useCallback((tone: 'success' | 'error', text: string) => {
    setNotice({ tone, text });
  }, []);

  React.useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  // -------------------------------------------------------------------------
  // Hydration
  // -------------------------------------------------------------------------

  const loadSession = React.useCallback(
    async (sessionId: string, options?: { silent?: boolean }) => {
      // Demo mode: state lives client-side, no API needed.
      if (demoMode) {
        const d = demoState;
        if (!d || d.sessionId !== sessionId) return;
        setSession(d as unknown as CourtSession);
        setTranscripts(d.transcripts);
        setPetitions([]);
        if (!options?.silent) setHydrating(false);
        return;
      }
      if (!options?.silent) setHydrating(true);
      try {
        const response = await fetch(`/api/courtroom/${sessionId}`, { cache: 'no-store' });
        if (!response.ok) {
          if (!options?.silent) {
            const payload = await response.json().catch(() => null);
            showNotice('error', payload?.error || 'Could not load this courtroom session.');
          }
          return;
        }
        const data = await response.json();
        setSession(data.session as CourtSession);
        setTranscripts((data.transcripts ?? []) as Transcript[]);
        setPetitions((data.petitions ?? []) as Petition[]);
      } catch {
        if (!options?.silent) {
          showNotice('error', 'Network error while loading the courtroom session.');
        }
      } finally {
        if (!options?.silent) setHydrating(false);
      }
    },
    [showNotice, demoMode, demoState]
  );

  React.useEffect(() => {
    if (!selectedSessionId) {
      setSession(null);
      setTranscripts([]);
      setPetitions([]);
      return;
    }
    lastTurnRef.current = -1;
    void loadSession(selectedSessionId);
  }, [selectedSessionId, loadSession]);

  // -------------------------------------------------------------------------
  // Supabase Realtime subscription (+ polling fallback for safety)
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    if (!selectedSessionId) return;

    const supabase = createClient();
    setRealtimeState('connecting');

    const refresh = () => {
      void loadSession(selectedSessionId, { silent: true });
    };

    const channel = supabase
      .channel(`courtroom:${selectedSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_sessions',
          filter: `id=eq.${selectedSessionId}`,
        },
        refresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_transcripts',
          filter: `session_id=eq.${selectedSessionId}`,
        },
        refresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_petitions',
          filter: `session_id=eq.${selectedSessionId}`,
        },
        refresh
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeState('live');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeState('polling');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedSessionId, loadSession]);

  const isActive = session ? ACTIVE_STATUSES.includes(session.status) : false;

  // -------------------------------------------------------------------------
  // Demo-mode polling (replaces Supabase Realtime when no backend is configured)
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    if (!selectedSessionId) return;
    if (!demoMode) return; // Supabase Realtime handles the live mode below

    const timer = setInterval(() => {
      void loadSession(selectedSessionId, { silent: true });
    }, 3000);
    return () => clearInterval(timer);
  }, [selectedSessionId, demoMode, loadSession]);

  // -------------------------------------------------------------------------
  // Supabase Realtime subscription (+ polling fallback for safety)
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    if (demoMode) return;
    if (!selectedSessionId) return;

    const supabase = createClient();
    setRealtimeState('connecting');

    const refresh = () => {
      void loadSession(selectedSessionId, { silent: true });
    };

    const channel = supabase
      .channel(`courtroom:${selectedSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_sessions',
          filter: `id=eq.${selectedSessionId}`,
        },
        refresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_transcripts',
          filter: `session_id=eq.${selectedSessionId}`,
        },
        refresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_petitions',
          filter: `session_id=eq.${selectedSessionId}`,
        },
        refresh
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeState('live');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeState('polling');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedSessionId, demoMode, loadSession]);

  React.useEffect(() => {
    if (!selectedSessionId || !isActive) return;
    const timer = setInterval(() => {
      void loadSession(selectedSessionId, { silent: true });
    }, 5000);
    return () => clearInterval(timer);
  }, [selectedSessionId, isActive, loadSession]);

  // Keep the transcript pinned to the newest speech.
  React.useEffect(() => {
    const newestTurn = transcripts.length > 0 ? transcripts[transcripts.length - 1].turnIndex : -1;
    if (newestTurn !== lastTurnRef.current) {
      lastTurnRef.current = newestTurn;
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [transcripts]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async function handleStartTrial(event: React.FormEvent) {
    event.preventDefault();
    if (starting) return;

    const trimmedMotion = motion.trim();
    if (!trimmedMotion) {
      setLauncherError('Enter a feature motion, architectural dilemma, or PR link.');
      return;
    }

    setLauncherError(null);
    setStarting(true);

    let repoContext: Record<string, unknown> = {};
    const rawContext = repoContextText.trim();
    if (rawContext) {
      try {
        const parsed = JSON.parse(rawContext);
        repoContext =
          parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : { notes: rawContext };
      } catch {
        repoContext = { notes: rawContext };
      }
    }

    if (demoMode) {
      const d = createDemoCourtroomState(room.id, trimmedMotion);
      setDemoState(d);
      const newSession: CourtSessionSummary = {
        id: d.sessionId,
        motion: trimmedMotion,
        status: d.status,
        created_at: d.createdAt,
        adopted_option_id: null,
      };
      setSessions((current) => [newSession, ...current]);
      setSelectedSessionId(d.sessionId);
      setMotion('');
      setRepoContextText('');
      setLauncherOpen(false);
      setStarting(false);
      showNotice('success', 'Court is now in session. The Clerk is routing the docket…');
      return;
    }

    try {
      const response = await fetch('/api/courtroom/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          motion: trimmedMotion,
          repoContext,
          fastDemoMode,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.sessionId) {
        setLauncherError(payload?.error || 'Could not start the trial.');
        return;
      }

      const newSession: CourtSessionSummary = {
        id: payload.sessionId,
        motion: trimmedMotion,
        status: 'routing',
        created_at: new Date().toISOString(),
        adopted_option_id: null,
      };

      setSessions((current) => [newSession, ...current]);
      setSelectedSessionId(payload.sessionId);
      setMotion('');
      setRepoContextText('');
      setLauncherOpen(false);
      showNotice('success', 'Court is now in session. The Clerk is routing the docket…');
    } catch {
      setLauncherError('Network error while starting the trial.');
    } finally {
      setStarting(false);
    }
  }

  async function handleInterject(event: React.FormEvent) {
    event.preventDefault();
    if (!session || posting) return;

    const message = interjection.trim();
    if (!message) return;

    setPosting(true);
    try {
      const response = await fetch('/api/courtroom/interject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, message }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        showNotice('error', payload?.error || 'Could not post your interjection.');
        return;
      }

      setInterjection('');
      void loadSession(session.id, { silent: true });
    } catch {
      showNotice('error', 'Network error while posting your interjection.');
    } finally {
      setPosting(false);
    }
  }

  async function handleAdopt(option: OptionCard) {
    const d = demoMode ? demoState : null;
    const s = d || session;
    if (!s || adoptingOptionId) return;

    setAdoptingOptionId(option.id);

    if (demoMode && d) {
      const result = adoptDemoOption(d, option.id);
      if (!result.ok) {
        setLauncherError(result.error || 'Could not adopt this option.');
        setAdoptingOptionId(null);
        return;
      }
      setSessions((current) =>
        current.map((entry) =>
          entry.id === d.sessionId
            ? { ...entry, status: 'adopted', adopted_option_id: option.id }
            : entry
        )
      );
      showNotice(
        'success',
        `Adopted “${option.title}” — created ${option.generated_tasks.length} tasks and synced ${option.agents_md_rules.length} rules to AGENTS.md.`
      );
      void loadSession(d.sessionId, { silent: true });
      setAdoptingOptionId(null);
      return;
    }

    try {
      if (!session) return;
      const response = await fetch('/api/courtroom/adopt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, optionId: option.id }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setLauncherError(payload?.error || 'Could not adopt this option.');
        return;
      }

      setSessions((current) =>
        current.map((entry) =>
          entry.id === session.id
            ? { ...entry, status: 'adopted', adopted_option_id: option.id }
            : entry
        )
      );

      showNotice(
        'success',
        `Adopted “${option.title}” — created ${payload?.tasksCreated ?? 0} tasks and synced ${
          payload?.rulesSynced ?? 0
        } rules to AGENTS.md.`
      );

      void loadSession(session.id, { silent: true });
    } catch {
      showNotice('error', 'Network error while adopting the option.');
    } finally {
      setAdoptingOptionId(null);
    }
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const activeSession = session && session.id === selectedSessionId ? session : null;
  const options = activeSession?.decision_options ?? [];
  const showDecisionMatrix =
    activeSession?.status === 'awaiting_human_choice' || activeSession?.status === 'adopted';

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-5 p-4 pb-32 lg:p-6">
        {/* Header ---------------------------------------------------------- */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-amber-300">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">AI Courtroom</h1>
                <p className="text-xs text-muted-foreground">
                  {room.name} · Adversarial architectural review, live
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                realtimeState === 'live' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                realtimeState === 'connecting' && 'border-slate-200 bg-white text-slate-500',
                realtimeState === 'polling' && 'border-amber-200 bg-amber-50 text-amber-700'
              )}
            >
              <Radio className="h-3 w-3" />
              {realtimeState === 'live'
                ? 'Realtime'
                : realtimeState === 'connecting'
                  ? 'Connecting…'
                  : 'Polling'}
            </div>
            <Button
              size="sm"
              variant={launcherOpen ? 'outline' : 'default'}
              onClick={() => setLauncherOpen((open) => !open)}
            >
              {launcherOpen ? (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Close Launcher
                </>
              ) : (
                <>
                  <PlusIcon />
                  New Trial
                </>
              )}
            </Button>
          </div>
        </div>

        {notice && (
          <div
            className={cn(
              'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
              notice.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            )}
          >
            {notice.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Session selector ------------------------------------------------ */}
        {sessions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="court-session" className="text-xs text-muted-foreground">
              Docket history
            </Label>
            <select
              id="court-session"
              value={selectedSessionId ?? ''}
              onChange={(event) => setSelectedSessionId(event.target.value || null)}
              className="h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {sessions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {statusLabel(entry.status)} · {entry.motion.slice(0, 60)}
                  {entry.motion.length > 60 ? '…' : ''}
                </option>
              ))}
            </select>
            {selectedSessionId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void loadSession(selectedSessionId)}
                disabled={hydrating}
              >
                <RefreshCw className={cn('mr-2 h-3.5 w-3.5', hydrating && 'animate-spin')} />
                Refresh
              </Button>
            )}
          </div>
        )}

        {/* Launcher -------------------------------------------------------- */}
        {launcherOpen && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scale className="h-5 w-5 text-slate-500" />
                Open a New Docket
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Submit a feature motion, architectural dilemma, or PR link. Seven courtroom agents
                will debate it and the Judge will hand you Option Cards.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStartTrial} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="motion">Motion</Label>
                  <Textarea
                    id="motion"
                    value={motion}
                    onChange={(event) => setMotion(event.target.value)}
                    maxLength={4000}
                    rows={4}
                    placeholder="e.g. Should we replace our REST polling with Supabase Realtime for the courtroom transcript stream? Or: https://github.com/org/repo/pull/42"
                    className="resize-y"
                  />
                  <p className="text-right text-[11px] text-muted-foreground">
                    {motion.length}/4,000
                  </p>
                </div>

                <details className="group rounded-lg border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-slate-700">
                    <span>Repo / PR Context (optional)</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-slate-100 p-3">
                    <Textarea
                      value={repoContextText}
                      onChange={(event) => setRepoContextText(event.target.value)}
                      rows={3}
                      placeholder='Paste JSON ({"repo":"owner/name","pr":42}) or plain notes about the codebase.'
                      className="resize-y font-mono text-xs"
                    />
                  </div>
                </details>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="fast-demo-mode"
                      checked={fastDemoMode}
                      onCheckedChange={setFastDemoMode}
                    />
                    <div>
                      <Label htmlFor="fast-demo-mode" className="cursor-pointer text-sm font-medium">
                        Fast Demo Mode (1 Rebuttal)
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        {fastDemoMode
                          ? '~20 second live demo · one floor grant'
                          : 'Full Docket (up to 2 Rebuttals) · full Phase 2 floor petitioning'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                    {fastDemoMode ? 'Fast Demo' : 'Full Docket'}
                  </Badge>
                </div>

                {launcherError && (
                  <p className="flex items-center gap-1.5 text-sm text-rose-600">
                    <AlertTriangle className="h-4 w-4" />
                    {launcherError}
                  </p>
                )}

                <Button type="submit" disabled={starting} className="w-full sm:w-auto">
                  {starting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Convening the Court…
                    </>
                  ) : (
                    <>
                      <Gavel className="mr-2 h-4 w-4" />
                      Start Trial
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Empty state ----------------------------------------------------- */}
        {!selectedSessionId && !launcherOpen && (
          <Card className="border-dashed border-slate-300 bg-white/60">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Landmark className="h-10 w-10 text-slate-300" />
              <div>
                <p className="font-medium text-slate-700">No trial selected</p>
                <p className="text-sm text-muted-foreground">
                  Start a new docket to convene the AI Courtroom.
                </p>
              </div>
              <Button onClick={() => setLauncherOpen(true)}>
                <PlusIcon />
                New Trial
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Arena ----------------------------------------------------------- */}
        {selectedSessionId && (
          <div className="space-y-4">
            {hydrating && !activeSession && (
              <Card className="border-slate-200">
                <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading the courtroom record…
                </CardContent>
              </Card>
            )}

            {activeSession && (
              <>
                {/* Status header */}
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Motion on the docket
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-slate-800">
                          {activeSession.motion}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Filed {formatRelativeTime(activeSession.created_at)} ·{' '}
                          {activeSession.phase2_grants_used} floor grant
                          {activeSession.phase2_grants_used === 1 ? '' : 's'} used
                        </p>
                      </div>
                      <WitnessBadges session={activeSession} />
                    </div>
                    <Separator />
                    <PhaseStepper status={activeSession.status} />
                    {activeSession.status === 'failed' && activeSession.error_message && (
                      <p className="rounded-md bg-rose-50 p-2 font-mono text-[11px] text-rose-700">
                        {activeSession.error_message}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Transcript stream */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      <MessageSquare className="h-4 w-4" />
                      Live Transcript
                    </h2>
                    <span className="text-[11px] text-slate-400">
                      {transcripts.length} speech{transcripts.length === 1 ? '' : 'es'}
                    </span>
                  </div>

                  {transcripts.length === 0 ? (
                    <Card className="border-dashed border-slate-300 bg-white/60">
                      <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        The Clerk is preparing the courtroom…
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {transcripts.map((entry) => (
                        <SpeakerCard key={entry.id} entry={entry} />
                      ))}
                      <div ref={transcriptEndRef} />
                    </div>
                  )}
                </div>

                {/* Floor petitions */}
                {petitions.length > 0 && (
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Scale className="h-4 w-4 text-slate-500" />
                        Floor Petitions &amp; Gavel Rulings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {petitions.map((petition) => (
                        <PetitionRow key={petition.id} petition={petition} />
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Decision matrix */}
                {showDecisionMatrix && (
                  <div className="space-y-4">
                    <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Gavel className="h-4 w-4 text-amber-600" />
                          The Judge&apos;s Synthesis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-0">
                        {activeSession.debate_summary && (
                          <SpeechContent content={activeSession.debate_summary} />
                        )}
                        {(activeSession.key_tensions ?? []).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                              Key Tensions
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {(activeSession.key_tensions ?? []).map((tension, index) => (
                                <div
                                  key={index}
                                  className="rounded-lg border border-amber-200 bg-white p-3"
                                >
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                    {Array.isArray(tension.between)
                                      ? tension.between.join(' vs ')
                                      : 'Tension'}
                                  </p>
                                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                                    {tension.tension}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {options.length > 0 ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {options.map((option) => (
                          <OptionCardView
                            key={option.id}
                            option={option}
                            adopted={activeSession.adopted_option_id === option.id}
                            adopting={adoptingOptionId === option.id}
                            disabled={activeSession.status !== 'awaiting_human_choice'}
                            onAdopt={() => void handleAdopt(option)}
                          />
                        ))}
                      </div>
                    ) : (
                      <Card className="border-dashed border-slate-300 bg-white/60">
                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                          The Judge is still drafting the Option Cards…
                        </CardContent>
                      </Card>
                    )}

                    {activeSession.status === 'adopted' && (
                      <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ruling adopted. Tasks were created and AGENTS.md was synced for local IDE
                        agents.
                      </p>
                    )}
                  </div>
                )}

                {/* Human bench interjection bar */}
                {isActive && (
                  <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
                    <form onSubmit={handleInterject} className="mx-auto flex max-w-6xl items-center gap-2">
                      <Input
                        value={interjection}
                        onChange={(event) => setInterjection(event.target.value)}
                        maxLength={2000}
                        placeholder="Post an Amicus Interjection to the bench…"
                        disabled={posting}
                      />
                      <Button type="submit" disabled={posting || !interjection.trim()}>
                        {posting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        <span className="ml-2 hidden sm:inline">Interject</span>
                      </Button>
                    </form>
                    <p className="mx-auto mt-1 max-w-6xl text-[10px] text-slate-400">
                      Signed in as a human teammate · the Judge reads every interjection before
                      synthesizing the final Option Cards.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Hidden userId anchor for parity with future presence features */}
        <span className="hidden" aria-hidden="true" data-current-user={currentUserId} />
      </div>
    </div>
  );
}

// Local icon wrapper (keeps the import list tidy)
function PlusIcon() {
  return <span className="mr-2 text-base leading-none">+</span>;
}
