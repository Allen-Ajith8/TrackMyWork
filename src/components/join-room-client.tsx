'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  FolderKanban, 
  Loader2, 
  Users, 
  Sparkles,
  LogIn,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function JoinRoomClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlRoomId = searchParams.get('roomId') || '';
  const urlCode = searchParams.get('code') || '';
  const urlEmail = searchParams.get('email') || '';

  const [code, setCode] = useState(urlCode);
  const [roomId, setRoomId] = useState(urlRoomId);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error' | 'unauthorized'>('idle');
  const [message, setMessage] = useState('');
  const [joinedRoom, setJoinedRoom] = useState<{ id: string; name: string } | null>(null);

  const performJoin = useCallback(async (joinCode: string, targetRoomId: string) => {
    if (!joinCode && !targetRoomId) {
      setStatus('error');
      setMessage('Please enter a 6-digit room invite code or invitation link.');
      return;
    }

    setLoading(true);
    setStatus('verifying');
    setMessage('Verifying invitation and connecting to workspace...');

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: joinCode.trim(),
          roomId: targetRoomId.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setStatus('unauthorized');
        setMessage(data.error || 'Please sign in to accept this invitation.');
        return;
      }

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Could not join room. Please check the code and try again.');
        return;
      }

      setStatus('success');
      setJoinedRoom({ id: data.roomId, name: data.roomName || 'Hackathon Room' });
      setMessage(data.message || `🎉 Welcome! Successfully joined ${data.roomName || 'the room'}.`);

      // Auto redirect to workspace after 1.2 seconds
      setTimeout(() => {
        router.push(`/dashboard/rooms/${data.roomId}`);
      }, 1200);
    } catch (err: any) {
      console.error('[Join Room] Error:', err);
      setStatus('error');
      setMessage(err?.message || 'Network error while joining room.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // If URL has roomId or code on load, automatically attempt join
  useEffect(() => {
    if (urlCode || urlRoomId) {
      performJoin(urlCode, urlRoomId);
    }
  }, [urlCode, urlRoomId, performJoin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performJoin(code, roomId);
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 shadow-md mb-3">
          <Key className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
          Join Hackathon Workspace
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Enter your team&apos;s 6-digit invite code or accept your email invitation to access your project.
        </p>
      </div>

      <Card className="border border-border/80 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              Teammate Invitation
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Supabase Verified
            </Badge>
          </div>
          {urlEmail && (
            <CardDescription className="text-xs pt-1">
              Invitation sent to: <span className="font-semibold text-foreground">{urlEmail}</span>
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status Feedback Banners */}
          {status === 'verifying' && (
            <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 flex items-center gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Connecting to your room...</p>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/80">Validating membership and synchronizing permissions</p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-base">You&apos;re in! Invitation Accepted.</p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">{message}</p>
                <p className="text-xs text-emerald-700/90 font-mono pt-1">
                  Redirecting to {joinedRoom?.name || 'workspace'}...
                </p>
              </div>
            </div>
          )}

          {status === 'unauthorized' && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-sm font-semibold">Account Sign In Required</p>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-200">{message}</p>
              <Button
                size="sm"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
                onClick={() => {
                  const current = window.location.pathname + window.location.search;
                  router.push(`/auth/login?redirect=${encodeURIComponent(current)}`);
                }}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In to Join Room
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-semibold">Unable to join</p>
                <p className="text-xs text-red-700 dark:text-red-300">{message}</p>
              </div>
            </div>
          )}

          {/* Form */}
          {status !== 'success' && (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="inviteCode" className="text-sm font-semibold">
                  6-Digit Room Invite Code
                </Label>
                <div className="relative">
                  <Input
                    id="inviteCode"
                    type="text"
                    placeholder="e.g. 477689 or INV-2026"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="font-mono text-lg tracking-widest text-center h-12 uppercase"
                    disabled={loading}
                    autoFocus
                  />
                  <Key className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4" />
                </div>
                <p className="text-xs text-muted-foreground">
                  The team leader can find this in their Room Header or Invite modal.
                </p>
              </div>

              {urlRoomId && (
                <div className="space-y-1 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
                  <span className="font-semibold">Target Room ID:</span> <span className="font-mono">{urlRoomId}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || (!code.trim() && !roomId.trim())}
                className="w-full h-11 text-base font-semibold bg-primary-600 hover:bg-primary-700 text-white shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Join Room Workspace
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          {status === 'success' && joinedRoom && (
            <Button
              className="w-full h-11 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => router.push(`/dashboard/rooms/${joinedRoom.id}`)}
            >
              Enter {joinedRoom.name}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <Link href="/dashboard/rooms" className="hover:text-foreground flex items-center gap-1">
            <FolderKanban className="w-3.5 h-3.5" />
            Back to Your Rooms
          </Link>
          <Link href="/dashboard/rooms/new" className="hover:text-foreground flex items-center gap-1 font-medium text-primary-600">
            <Sparkles className="w-3.5 h-3.5" />
            Create a New Room
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
