'use client';

import * as React from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Gavel,
  Loader2,
  Scale,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Artifact } from '@/types/database';

interface CourtroomArtifact {
  id: string;
  title: string;
  type: string;
  kind: string;
  isRulebook: boolean;
  hasText: boolean;
  excerptChars?: number;
}

interface CourtroomTurn {
  agentId: 'advocate' | 'skeptic' | 'judge';
  agentName: string;
  role: string;
  content: string;
  referencedArtifacts: CourtroomArtifact[];
  usedFallback: boolean;
}

interface CourtroomResult {
  topic: string;
  roomName: string;
  artifacts: CourtroomArtifact[];
  turns: CourtroomTurn[];
  verdict: {
    content: string;
    verdict: string;
    score: number | null;
    citedArtifacts: CourtroomArtifact[];
  };
  usedFallback: boolean;
  hasRulebook: boolean;
  usedArtifactCount?: number;
}

const AGENT_STYLES: Record<
  CourtroomTurn['agentId'],
  { icon: React.ComponentType<{ className?: string }>; border: string; chip: string; label: string }
> = {
  advocate: {
    icon: Sparkles,
    border: 'border-emerald-200',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    label: 'Advocate / Proponent',
  },
  skeptic: {
    icon: Shield,
    border: 'border-amber-200',
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
    label: 'Skeptic / Critic',
  },
  judge: {
    icon: Gavel,
    border: 'border-indigo-200',
    chip: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    label: 'Judge / Moderator',
  },
};

function verdictColor(verdict: string): string {
  if (verdict === 'PASS') return 'bg-emerald-600 text-white';
  if (verdict === 'FAIL') return 'bg-red-600 text-white';
  return 'bg-amber-500 text-white';
}

function ArtifactChips({ artifacts }: { artifacts: CourtroomArtifact[] }) {
  if (artifacts.length === 0) {
    return (
      <span className="text-[11px] text-muted-foreground">
        No artifacts loaded. Upload rules.md or a research note in Artifacts.
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {artifacts.map((artifact) => (
        <Badge
          key={artifact.id}
          variant="outline"
          className={cn(
            'text-[10px] font-medium gap-1',
            artifact.isRulebook
              ? 'border-purple-300 bg-purple-50 text-purple-800'
              : 'border-surface-200 bg-white text-surface-700'
          )}
          title={`${artifact.type}${artifact.kind ? ` · ${artifact.kind}` : ''}${
            artifact.hasText ? ` · ${artifact.excerptChars || 0} chars indexed` : ' · text not extracted'
          }`}
        >
          <FileText className="w-2.5 h-2.5" />
          {artifact.title}
          {artifact.isRulebook && <span className="font-bold">RULEBOOK</span>}
        </Badge>
      ))}
    </div>
  );
}

export function CourtroomPanel({
  roomId,
  roomName,
  initialArtifacts = [],
}: {
  roomId: string;
  roomName: string;
  initialArtifacts?: Artifact[];
}) {
  const initialRefs = React.useMemo<CourtroomArtifact[]>(
    () =>
      initialArtifacts.map((artifact) => ({
        id: artifact.id,
        title: artifact.name,
        type: artifact.type,
        kind: String(artifact.kind || 'file'),
        isRulebook: /rules?|rulebook|rubric|constraint|spec/i.test(artifact.name),
        hasText: Boolean(artifact.extracted_text || artifact.content),
        excerptChars: (artifact.extracted_text || artifact.content || '').length,
      })),
    [initialArtifacts]
  );

  const [artifacts, setArtifacts] = React.useState<CourtroomArtifact[]>(initialRefs);
  const [hasRulebook, setHasRulebook] = React.useState(
    initialRefs.some((artifact) => artifact.isRulebook)
  );
  const [showArtifacts, setShowArtifacts] = React.useState(false);
  const [topic, setTopic] = React.useState(
    'Does our current project satisfy the room rules and judging rubric?'
  );
  const [result, setResult] = React.useState<CourtroomResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    fetch(`/api/rooms/${roomId}/courtroom`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data?.artifacts)) return;
        setArtifacts(data.artifacts);
        setHasRulebook(Boolean(data.hasRulebook));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const runCourtroom = async () => {
    const motion = topic.trim();
    if (!motion || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/rooms/${roomId}/courtroom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: motion }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'The Courtroom could not run.');
      }

      setResult(data as CourtroomResult);
      if (Array.isArray(data?.artifacts)) {
        setArtifacts(data.artifacts);
        setHasRulebook(Boolean(data.hasRulebook));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The Courtroom could not run.');
    } finally {
      setLoading(false);
    }
  };

  const shownArtifacts = result?.artifacts?.length ? result.artifacts : artifacts;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Scale className="w-5 h-5 text-purple-700" />
                  AI Courtroom
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Advocate, Skeptic and Judge debate {roomName} using the room&apos;s artifacts as
                  binding evidence.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1.5 text-[11px] font-semibold',
                    shownArtifacts.length > 0
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-amber-300 bg-amber-50 text-amber-800'
                  )}
                >
                  <BookOpen className="w-3 h-3" />
                  {shownArtifacts.length} room artifact{shownArtifacts.length === 1 ? '' : 's'} loaded
                </Badge>
                {hasRulebook && (
                  <Badge className="gap-1 text-[10px] bg-purple-700 text-white">
                    <Gavel className="w-2.5 h-2.5" />
                    Rulebook grounded
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={() => setShowArtifacts((value) => !value)}
                  className="text-[11px] font-semibold text-purple-700 hover:underline inline-flex items-center gap-1"
                >
                  {showArtifacts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showArtifacts ? 'Hide loaded artifacts' : 'View loaded artifacts'}
                </button>
              </div>
            </div>
          </CardHeader>

          {showArtifacts && (
            <CardContent className="pt-0">
              <div className="rounded-lg border bg-white/80 p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Artifacts injected into every agent&apos;s system context
                </p>
                <ArtifactChips artifacts={shownArtifacts} />
              </div>
            </CardContent>
          )}

          <CardContent className="space-y-3 pt-0">
            <Textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              rows={2}
              placeholder="Motion for the Courtroom, e.g. Does our project satisfy the rules.md constraints and judging rubric?"
              className="bg-white text-xs"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Agents cite artifact titles such as <code className="font-mono">`rules.md`</code> in
                their arguments and verdict.
              </p>
              <Button
                onClick={runCourtroom}
                disabled={loading || !topic.trim()}
                className="gap-2 bg-purple-700 hover:bg-purple-800 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                {loading ? 'Courtroom in session…' : 'Convene Courtroom'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {result?.usedFallback && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
            Offline grounded mode: NVIDIA NIM is not configured or unavailable, so the agents used
            the room artifacts directly to produce this debate.
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {result.verdict && (
              <Card className="border-indigo-200">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Gavel className="w-4 h-4 text-indigo-700" />
                      Final Verdict
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={verdictColor(result.verdict.verdict)}>
                        {result.verdict.verdict}
                      </Badge>
                      {result.verdict.score !== null && (
                        <Badge variant="outline" className="font-mono">
                          {result.verdict.score}/100
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-surface-800">
                    {result.verdict.content}
                  </p>
                  <div className="pt-2 border-t">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Verdict evidence
                    </p>
                    <ArtifactChips artifacts={result.verdict.citedArtifacts || []} />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-3">
              {result.turns.map((turn) => {
                const style = AGENT_STYLES[turn.agentId];
                const Icon = style.icon;
                return (
                  <Card key={turn.agentId} className={cn('overflow-hidden', style.border)}>
                    <CardHeader className="py-3 bg-white/70">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('p-1.5 rounded-md border', style.chip)}>
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <div>
                            <CardTitle className="text-sm font-bold">{turn.agentName}</CardTitle>
                            <p className="text-[10px] text-muted-foreground">{style.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {turn.usedFallback && (
                            <Badge variant="outline" className="text-[9px]">
                              offline grounded
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[9px]">
                            {turn.referencedArtifacts.length} cited
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3 space-y-3">
                      <div className="text-xs leading-relaxed whitespace-pre-wrap text-surface-800">
                        {turn.content}
                      </div>
                      <div className="pt-2 border-t">
                        <ArtifactChips artifacts={turn.referencedArtifacts} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="rounded-xl border border-dashed bg-surface-50/60 p-8 text-center">
            <Scale className="w-10 h-10 mx-auto text-purple-300" />
            <p className="mt-3 text-sm font-semibold text-surface-800">
              The Courtroom is ready
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg mx-auto">
              Every agent receives the same [ROOM ARTIFACTS &amp; RULEBOOKS] block. Upload
              <code className="mx-1 font-mono">rules.md</code>, a rubric or research notes in
              Artifacts, then convene the Courtroom to see them cited in the debate and verdict.
            </p>
          </div>
        )}

        {loading && (
          <div className="rounded-xl border bg-white p-6 space-y-3">
            {['Advocate is preparing the case…', 'Skeptic is checking compliance…', 'Judge is drafting the verdict…'].map(
              (label, index) => (
                <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px]">
                    {index + 1}
                  </span>
                  {label}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
