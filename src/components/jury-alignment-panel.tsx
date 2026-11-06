'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import {
  Gauge,
  Brain,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  RefreshCw,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Room } from '@/types/database';

interface AlignmentResult {
  alignment_score: number;
  feedback: string;
  scope_creep: string[];
  strengths: string[];
  risks: string[];
  recommendations: string[];
}

interface MockQA {
  question: string;
  answer: string;
  category: 'technical' | 'product' | 'business' | 'team';
}

interface ScopeCheckResult {
  scope_creep_detected: boolean;
  severity: 'low' | 'medium' | 'high';
  creep_items: { commit: string; reason: string; suggestion: string }[];
  within_scope: string[];
}

export function JuryAlignmentPanel({ room }: { room: Room }) {
  const [alignment, setAlignment] = React.useState<AlignmentResult | null>(null);
  const [mockQA, setMockQA] = React.useState<MockQA[]>([]);
  const [scopeCheck, setScopeCheck] = React.useState<ScopeCheckResult | null>(null);
  const [loading, setLoading] = React.useState<{ align: boolean; mock_qa: boolean; scope: boolean }>({
    align: false,
    mock_qa: false,
    scope: false,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [showFullFeedback, setShowFullFeedback] = React.useState(false);

  const callJuryApi = async (action: 'align' | 'mock_qa' | 'scope_check') => {
    setLoading(prev => ({ ...prev, [action]: true }));
    setError(null);

    try {
      const response = await fetch('/api/nim/jury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room.id, action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze');
      }

      switch (action) {
        case 'align':
          setAlignment(data.data);
          break;
        case 'mock_qa':
          setMockQA(data.data);
          break;
        case 'scope_check':
          setScopeCheck(data.data);
          break;
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(prev => ({ ...prev, [action]: false }));
    }
  };

  const runAll = async () => {
    await Promise.all([
      callJuryApi('align'),
      callJuryApi('mock_qa'),
      callJuryApi('scope_check'),
    ]);
  };

  useEffect(() => {
    if (room.jury_expectations) {
      runAll();
    }
  }, [room.id, room.jury_expectations]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const CATEGORY_COLORS = {
    technical: 'bg-blue-100 text-blue-800',
    product: 'bg-purple-100 text-purple-800',
    business: 'bg-green-100 text-green-800',
    team: 'bg-orange-100 text-orange-800',
  };

  const CATEGORY_ICONS = {
    technical: <Code className="w-3 h-3" />,
    product: <Zap className="w-3 h-3" />,
    business: <Target className="w-3 h-3" />,
    team: <Users className="w-3 h-3" />,
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              Jury Alignment
            </CardTitle>
            <CardDescription>
              AI-powered analysis against your jury expectations rubric
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <Badge variant="secondary" className="text-xs">
                Updated {formatRelativeTime(lastUpdated)}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={runAll}
              disabled={Object.values(loading).some(v => v)}
            >
              {loading.align || loading.mock_qa || loading.scope ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Refresh All
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh All
                </>
              )}
            </Button>
          </div>
        </div>

        {room.jury_expectations && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium text-muted-foreground mb-1">Jury Expectations:</p>
            <p className="text-sm line-clamp-3">{room.jury_expectations}</p>
          </div>
        )}

        {!room.jury_expectations && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              No jury expectations set. Configure in Room Settings → Rules to enable alignment analysis.
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <Tabs defaultValue="alignment" className="h-[calc(100%-140px)]">
          <TabsList className="mb-4">
            <TabsTrigger value="alignment" className="flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Alignment
            </TabsTrigger>
            <TabsTrigger value="mock_qa" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Mock Q&A
            </TabsTrigger>
            <TabsTrigger value="scope" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Scope Check
            </TabsTrigger>
          </TabsList>

          {/* Alignment Tab */}
          <TabsContent value="alignment" className="h-full">
            {loading.align ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : !alignment ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Click "Refresh All" to run alignment analysis</p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-6">
                  {/* Score Gauge */}
                  <div className="text-center py-4">
                    <div className="relative inline-flex items-center justify-center">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          className="text-muted-foreground/20"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          strokeDasharray={352}
                          strokeDashoffset={352 - (352 * alignment.alignment_score) / 100}
                          strokeLinecap="round"
                          className={cn('transition-all duration-1000', getScoreBg(alignment.alignment_score))}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={cn('text-4xl font-bold', getScoreColor(alignment.alignment_score))}>
                          {alignment.alignment_score}%
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Alignment Score</p>
                    <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        {alignment.strengths.length} Strengths
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <TrendingDown className="w-4 h-4" />
                        {alignment.risks.length} Risks
                      </span>
                      <span className="flex items-center gap-1 text-yellow-600">
                        <AlertTriangle className="w-4 h-4" />
                        {alignment.scope_creep.length} Scope Creep
                      </span>
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Feedback</h4>
                    <div className={cn('p-4 bg-muted/50 rounded-lg text-sm', showFullFeedback ? '' : 'max-h-40 overflow-hidden')}>
                      {alignment.feedback}
                    </div>
                    {alignment.feedback.length > 300 && (
                      <Button variant="ghost" size="sm" onClick={() => setShowFullFeedback(!showFullFeedback)} className="gap-1">
                        {showFullFeedback ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {showFullFeedback ? 'Show Less' : 'Show More'}
                      </Button>
                    )}
                  </div>

                  {/* Strengths */}
                  {alignment.strengths.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Strengths
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {alignment.strengths.map((s, i) => (
                          <Badge key={i} variant="secondary" className="bg-green-50 text-green-800 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risks */}
                  {alignment.risks.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2 text-red-600">
                        <XCircle className="w-4 h-4" />
                        Risks
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {alignment.risks.map((r, i) => (
                          <Badge key={i} variant="secondary" className="bg-red-50 text-red-800 border-red-200">
                            <XCircle className="w-3 h-3 mr-1" />
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scope Creep */}
                  {alignment.scope_creep.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2 text-yellow-600">
                        <AlertTriangle className="w-4 h-4" />
                        Scope Creep Detected
                      </h4>
                      <div className="space-y-1">
                        {alignment.scope_creep.map((s, i) => (
                          <Badge key={i} variant="secondary" className="bg-yellow-50 text-yellow-800 border-yellow-200 w-full justify-start">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {alignment.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2 text-blue-600">
                        <Target className="w-4 h-4" />
                        Recommendations
                      </h4>
                      <div className="space-y-1">
                        {alignment.recommendations.map((r, i) => (
                          <div key={i} className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                            <div className="flex items-start gap-2">
                              <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <span>{r}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Mock Q&A Tab */}
          <TabsContent value="mock_qa" className="h-full">
            {loading.mock_qa ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : mockQA.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                <p>No mock Q&A generated yet</p>
                <Button variant="outline" size="sm" onClick={() => callJuryApi('mock_qa')}>
                  Generate Mock Q&A
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  {mockQA.map((qa, i) => (
                    <Card key={i} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <span className={cn('badge', CATEGORY_COLORS[qa.category])}>
                            {CATEGORY_ICONS[qa.category]}
                            {qa.category.charAt(0).toUpperCase() + qa.category.slice(1)}
                          </span>
                          <span className="text-sm text-muted-foreground">Q{i + 1}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="font-medium">Q: {qa.question}</p>
                        </div>
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800"><strong>A:</strong> {qa.answer}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Scope Check Tab */}
          <TabsContent value="scope" className="h-full">
            {loading.scope ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : !scopeCheck ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
                <p>No scope check run yet</p>
                <Button variant="outline" size="sm" onClick={() => callJuryApi('scope_check')}>
                  Run Scope Check
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-6">
                  {/* Summary */}
                  <div className={cn('p-4 rounded-lg text-center', scopeCheck.scope_creep_detected ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200')}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {scopeCheck.scope_creep_detected ? (
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                      ) : (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      )}
                      <h3 className="text-lg font-semibold">
                        {scopeCheck.scope_creep_detected ? 'Scope Creep Detected' : 'Within Scope'}
                      </h3>
                    </div>
                    <div className="flex items-center justify-center gap-4 text-sm">
                      <Badge variant={scopeCheck.severity === 'high' ? 'destructive' : scopeCheck.severity === 'medium' ? 'secondary' : 'outline'}>
                        Severity: {scopeCheck.severity}
                      </Badge>
                      <Badge variant="secondary">
                        {scopeCheck.creep_items.length} Issues
                      </Badge>
                      <Badge variant="secondary">
                        {scopeCheck.within_scope.length} Aligned
                      </Badge>
                    </div>
                  </div>

                  {/* Creep Items */}
                  {scopeCheck.creep_items.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Scope Creep Items
                      </h4>
                      <div className="space-y-2">
                        {scopeCheck.creep_items.map((item, i) => (
                          <Card key={i} className="border-red-200">
                            <CardContent className="pt-4 pb-2">
                              <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="font-medium text-sm">Commit: <code className="text-xs bg-muted px-1 rounded">{item.commit}</code></p>
                                  <p className="text-sm text-muted-foreground mt-1">Reason: {item.reason}</p>
                                  <p className="text-sm text-blue-600 mt-1"><strong>Suggestion:</strong> {item.suggestion}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Within Scope */}
                  {scopeCheck.within_scope.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-600 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Well-Aligned Commits
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {scopeCheck.within_scope.map((commit, i) => (
                          <Badge key={i} variant="secondary" className="bg-green-50 text-green-800 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {commit.slice(0, 50)}{commit.length > 50 ? '...' : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}