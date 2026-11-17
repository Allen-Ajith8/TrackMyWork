'use client';

import * as React from 'react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import {
  AlertTriangle,
  Loader2,
  Terminal,
  Code,
  GitBranch,
  Zap,
  CheckCircle,
  XCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Toast, ToastProvider, ToastViewport, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Room, RoomMember, User } from '@/types/database';

interface SosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomMembers: (RoomMember & { user: User })[];
  initialErrorLog?: string;
  initialContext?: 'android_logcat' | 'rust_compiler' | 'flutter_build' | 'general';
  initialFiles?: string[];
}

export function SosButton({ roomId, roomMembers, initialErrorLog, initialContext, initialFiles }: Omit<SosDialogProps, 'open' | 'onOpenChange'>) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2 animate-pulse" size="lg">
          <AlertTriangle className="w-5 h-5" />
          SOS Debug
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            SOS Debug Assistant
          </DialogTitle>
        </DialogHeader>
        <SosDialogContent
          roomId={roomId}
          roomMembers={roomMembers}
          initialErrorLog={initialErrorLog}
          initialContext={initialContext}
          initialFiles={initialFiles}
          onClose={() => setDialogOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SosDialogContent({ roomId, roomMembers, initialErrorLog, initialContext, initialFiles, onClose }: Omit<SosDialogProps, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const { user } = useAuthStore();
  const [errorLog, setErrorLog] = React.useState(initialErrorLog || '');
  const [context, setContext] = React.useState<'android_logcat' | 'rust_compiler' | 'flutter_build' | 'general'>(initialContext || 'general');
  const [relevantFiles, setRelevantFiles] = React.useState(initialFiles || []);
  const [newFile, setNewFile] = React.useState('');
  const [analysis, setAnalysis] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [usage, setUsage] = React.useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number; latency_ms: number } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [showFull, setShowFull] = React.useState(false);

  const CONTEXT_OPTIONS = [
    { value: 'android_logcat', label: 'Android Logcat', icon: Terminal },
    { value: 'rust_compiler', label: 'Rust Compiler', icon: Code },
    { value: 'flutter_build', label: 'Flutter Build', icon: Zap },
    { value: 'general', label: 'General Error', icon: Info },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!errorLog.trim()) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch('/api/nim/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          error_log: errorLog,
          context,
          relevant_files: relevantFiles,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze');
      }

      setAnalysis(data.analysis);
      setUsage(data.usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (analysis) {
      await navigator.clipboard.writeText(analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadAnalysis = () => {
    if (analysis) {
      const blob = new Blob([analysis], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sos-debug-${context}-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const addFile = () => {
    if (newFile.trim() && !relevantFiles.includes(newFile.trim())) {
      setRelevantFiles([...relevantFiles, newFile.trim()]);
      setNewFile('');
    }
  };

  const removeFile = (file: string) => {
    setRelevantFiles(relevantFiles.filter(f => f !== file));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Input Section */}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Error Context</Label>
            <Select onValueChange={setContext} defaultValue={context}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTEXT_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" /> {opt.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Relevant Files</Label>
            <div className="flex gap-2">
              <Input
                value={newFile}
                onChange={(e) => setNewFile(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFile())}
                placeholder="src/main.rs, android/app/src/... (press Enter to add)"
              />
              <Button type="button" variant="outline" onClick={addFile}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {relevantFiles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {relevantFiles.map(file => (
                  <Badge key={file} variant="secondary" className="gap-1">
                    {file}
                    <button type="button" onClick={() => removeFile(file)} className="ml-1">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="error_log">Error Log *</Label>
          <Textarea
            id="error_log"
            value={errorLog}
            onChange={(e) => setErrorLog(e.target.value)}
            placeholder={`Paste your ${context.replace('_', ' ')} error here...

Examples:
• Android Logcat: adb logcat -d | tail -100
• Rust: cargo build 2>&1 | tail -50
• Flutter: flutter build apk --verbose 2>&1 | tail -100`}
            rows={15}
            className="font-mono text-sm"
            required
          />
          <p className="text-xs text-muted-foreground">
            Tip: Include full stack trace, relevant file paths, and recent code changes
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading || !errorLog.trim()} className="w-full" size="lg">
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing with DeepSeek-R1...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" />
              Analyze Error
            </>
          )}
        </Button>
      </div>

      {/* Results Section */}
      {analysis && (
        <div className="space-y-4 border-t pt-6 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Analysis Complete
            </h3>
            <div className="flex items-center gap-2">
              {usage && (
                <Badge variant="secondary" className="gap-1">
                  <Zap className="w-3 h-3" />
                  {usage.latency_ms}ms · {usage.total_tokens} tokens
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={copyToClipboard}>
                {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={downloadAnalysis}>
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowFull(!showFull)}>
                {showFull ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <ScrollArea className="max-h-[500px]">
            <div className={cn('p-4 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap', showFull ? '' : 'max-h-96 overflow-hidden')}>
              {analysis}
            </div>
          </ScrollArea>

          {!showFull && analysis.length > 2000 && (
            <p className="text-center text-sm text-muted-foreground">
              Analysis truncated. Click expand to view full response.
            </p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </form>
  );
}