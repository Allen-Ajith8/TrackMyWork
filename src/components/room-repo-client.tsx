'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useRoomStore } from '@/lib/store';
import { normalizeGitHubRepoInput } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Github, ArrowRight, Check, X, Loader2, ExternalLink } from 'lucide-react';
import type { Room } from '@/types/database';

interface RoomRepoClientProps {
  room: Room;
}

export function RoomRepoClient({ room }: RoomRepoClientProps) {
  const supabase = createClient();
  const { user } = useAuthStore();
  const { currentRoom, setCurrentRoom } = useRoomStore();

  const [editing, setEditing] = useState(false);
  const [repoValue, setRepoValue] = useState(room.github_repo || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const currentUrl = room.github_repo
    ? `https://github.com/${new URL(room.github_repo).pathname.replace(/^\/+/, '')}`
    : null;

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);

    const parsed = normalizeGitHubRepoInput(repoValue);
    if (!parsed) {
      setStatus({ type: 'error', message: 'Enter a valid GitHub repo URL (e.g. https://github.com/owner/repo).' });
      return;
    }

    setSaving(true);
    const nextRepo = parsed.url;

    (async () => {
      try {
        const { error } = await supabase
          .from('rooms')
          .update({ github_repo: nextRepo, updated_at: new Date().toISOString() })
          .eq('id', room.id);

        if (error) throw error;

        if (user && currentRoom) {
          setCurrentRoom({ ...currentRoom, github_repo: nextRepo });
        }

        setStatus({ type: 'success', message: 'Repository linked successfully.' });
        setEditing(false);
        // Refresh the room data from the page by re-reading the store won't update
        // the prop; we update locally so the UI reflects the new value immediately.
      } catch (error) {
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Could not link the repository.',
        });
      } finally {
        setSaving(false);
      }
    })();
  }

  function handleRemove() {
    setStatus(null);
    setSaving(true);
    (async () => {
      try {
        const { error } = await supabase
          .from('rooms')
          .update({ github_repo: null, updated_at: new Date().toISOString() })
          .eq('id', room.id);

        if (error) throw error;

        if (user && currentRoom) {
          setCurrentRoom({ ...currentRoom, github_repo: null });
        }

        setRepoValue('');
        setStatus({ type: 'success', message: 'Repository unlinked.' });
      } catch (error) {
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Could not unlink the repository.',
        });
      } finally {
        setSaving(false);
      }
    })();
  }

  const canManage =
    Boolean(user) &&
    (currentRoom?.created_by === user?.id || Boolean(room.created_by === user?.id));

  return (
    <Card className="border border-surface-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Github className="w-4 h-4" />
          Room Repository
        </CardTitle>
        <CardDescription className="text-xs">
          Link this room to a GitHub repo so commits and PRs can be tracked.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing && currentUrl ? (
          <>
            <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg border border-surface-100">
              <span className="text-xs text-surface-500 truncate">Linked repo:</span>
              <Link
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary-600 hover:underline text-sm truncate flex-1 max-w-xs"
              >
                {room.github_repo}
                <ExternalLink className="w-3 h-3 ml-1" />
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="shrink-0"
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="text-red-600 shrink-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-xs text-surface-500">
              GitHub webhooks pointing at this room will auto-update tasks and
              pull requests.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-surface-500">
              No GitHub repository linked yet. Add one to connect commits and
              pull requests to this room.
            </p>
            {!editing && (
              <Button
                variant="outline"
                onClick={() => setEditing(true)}
                className="w-fit"
              >
                <Github className="w-4 h-4 mr-2" />
                Link Repository
              </Button>
            )}
          </>
        )}

        {editing && (
          <form onSubmit={handleSave} className="space-y-3">
            <Label htmlFor="room-repo">GitHub Repository URL</Label>
            <div className="relative">
              <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <Input
                id="room-repo"
                value={repoValue}
                onChange={(event) => setRepoValue(event.target.value)}
                placeholder="https://github.com/owner/repo"
                disabled={saving}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-surface-500 mt-1">
              Public repo URL. We never write to your repo — only read webhook
              events.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Link Repository'}
              </Button>
            </div>
            {status && (
              <div
                className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
                  status.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {status.type === 'success' && <Check className="w-4 h-4" />}
                {status.type === 'error' && <X className="w-4 h-4" />}
                {status.message}
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
