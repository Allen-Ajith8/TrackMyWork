'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useRoomStore } from '@/lib/store';
import { normalizeGitHubRepoInput } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Github,
  Check,
  X,
  Loader2,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  FileDown,
} from 'lucide-react';
import type { Room } from '@/types/database';

interface RoomRepoClientProps {
  room: Room;
  canManageRepo?: boolean;
}

interface InstallationRepo {
  id: number;
  full_name: string;
  html_url: string;
  private: boolean;
}

type Status = { type: 'success' | 'error'; message: string } | null;

export function RoomRepoClient({ room, canManageRepo }: RoomRepoClientProps) {
  const [supabase] = useState(() => createClient());
  const { user } = useAuthStore();
  const { currentRoom, setCurrentRoom } = useRoomStore();

  const [installationId, setInstallationId] = useState<number | null>(
    room.github_installation_id ?? null
  );
  const [linkedRepo, setLinkedRepo] = useState<string | null>(room.github_repo ?? null);

  const [editing, setEditing] = useState(false);
  const [repoValue, setRepoValue] = useState(room.github_repo || '');
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [repos, setRepos] = useState<InstallationRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [linking, setLinking] = useState(false);

  const isConnected = Boolean(installationId);
  const hasRepo = Boolean(linkedRepo);
  const needsRepoSelection = Boolean(installationId && !linkedRepo);
  const pickerVisible = isConnected && (needsRepoSelection || showPicker);

  const normalizedLinked = linkedRepo ? normalizeGitHubRepoInput(linkedRepo) : null;
  const repoHref = normalizedLinked?.url ?? null;
  const repoLabel = normalizedLinked
    ? `${normalizedLinked.owner}/${normalizedLinked.repo}`
    : linkedRepo;

  const canManage =
    canManageRepo ??
    (Boolean(user) &&
      (currentRoom?.created_by === user?.id || Boolean(room.created_by === user?.id)));

  const connectHref = `/api/github/connect?roomId=${encodeURIComponent(room.id)}`;

  // Surface the result of the GitHub round-trip, then clean the URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('github_connected');
    const error = params.get('github_error');

    if (connected) setStatus({ type: 'success', message: connected });
    else if (error) setStatus({ type: 'error', message: error });

    if (connected || error) {
      params.delete('github_connected');
      params.delete('github_error');
      const query = params.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`
      );
    }
  }, []);

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    setReposError(null);
    try {
      const res = await fetch(
        `/api/github/installation-repos?roomId=${encodeURIComponent(room.id)}`,
        { cache: 'no-store' }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not load repositories from GitHub.');
      }
      const nextRepos: InstallationRepo[] = data?.repos ?? [];
      setRepos(nextRepos);
      setSelectedRepo((prev) => prev || nextRepos[0]?.full_name || '');
    } catch (error) {
      setReposError(
        error instanceof Error ? error.message : 'Could not load repositories.'
      );
    } finally {
      setReposLoading(false);
    }
  }, [room.id]);

  useEffect(() => {
    if (pickerVisible) void loadRepos();
  }, [pickerVisible, loadRepos]);

  function updateStore(patch: Partial<Room>) {
    if (user && currentRoom) {
      setCurrentRoom({ ...currentRoom, ...patch });
    }
  }

  function handleSaveManual(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);

    const parsed = normalizeGitHubRepoInput(repoValue);
    if (!parsed) {
      setStatus({
        type: 'error',
        message: 'Enter a valid GitHub repo URL (e.g. https://github.com/owner/repo).',
      });
      return;
    }

    setSaving(true);
    (async () => {
      try {
        const { error } = await supabase
          .from('rooms')
          .update({ github_repo: parsed.url, updated_at: new Date().toISOString() })
          .eq('id', room.id);

        if (error) throw error;

        setLinkedRepo(parsed.url);
        setRepoValue(parsed.url);
        updateStore({ github_repo: parsed.url });
        setStatus({
          type: 'success',
          message: isConnected
            ? 'Repository updated.'
            : 'Repository linked. Connect GitHub to enable automatic webhooks and commit sync.',
        });
        setEditing(false);
      } catch (error) {
        setStatus({
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Could not link the repository.',
        });
      } finally {
        setSaving(false);
      }
    })();
  }

  function handleLinkRepo() {
    if (!selectedRepo) return;
    setLinking(true);
    setStatus(null);

    (async () => {
      try {
        const res = await fetch('/api/github/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: room.id, repoFullName: selectedRepo }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || 'Could not link that repository.');
        }

        setLinkedRepo(data.repo.html_url);
        setRepoValue(data.repo.html_url);
        updateStore({ github_repo: data.repo.html_url });
        setStatus({
          type: 'success',
          message: `Linked ${data.repo.full_name}. Webhooks are now active for this room.`,
        });
        setShowPicker(false);
      } catch (error) {
        setStatus({
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Could not link that repository.',
        });
      } finally {
        setLinking(false);
      }
    })();
  }

  function handleDisconnect() {
    setDisconnecting(true);
    setStatus(null);

    (async () => {
      try {
        const res = await fetch('/api/github/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: room.id, action: 'disconnect' }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || 'Could not disconnect GitHub.');
        }

        setInstallationId(null);
        setLinkedRepo(null);
        setRepoValue('');
        setRepos([]);
        setSelectedRepo('');
        setShowPicker(false);
        setEditing(false);
        updateStore({ github_repo: null, github_installation_id: null });
        setStatus({
          type: 'success',
          message: isConnected
            ? 'GitHub disconnected from this room.'
            : 'Repository unlinked.',
        });
      } catch (error) {
        setStatus({
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Could not disconnect GitHub.',
        });
      } finally {
        setDisconnecting(false);
      }
    })();
  }

  return (
    <Card className="border border-surface-200">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Github className="w-4 h-4" />
          Room Repository
        </CardTitle>
        <CardDescription className="text-xs">
          Connect a GitHub repository so commits, PRs, and issues sync to this room.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status && (
          <div
            className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
              status.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {status.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <X className="w-4 h-4 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        {hasRepo ? (
          <>
            <div className="flex flex-wrap items-center gap-3 p-3 bg-surface-50 rounded-lg border border-surface-100">
              {isConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                  <ShieldCheck className="w-3 h-3" />
                  GitHub App connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <Github className="w-3 h-3" />
                  Linked manually
                </span>
              )}
              {repoHref && repoLabel ? (
                <Link
                  href={repoHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary-600 hover:underline text-sm truncate flex-1 max-w-xs"
                >
                  {repoLabel}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              ) : (
                <span className="text-xs text-surface-500 flex-1">
                  Installation linked — choose a repository to finish setup.
                </span>
              )}
            </div>

            <p className="text-xs text-surface-500">
              {isConnected
                ? 'Webhooks are configured automatically. Pushes, pull requests, and issues on this repository update the room in real time.'
                : 'This URL is stored, but webhooks are not installed. Connect GitHub to enable automatic sync.'}
            </p>

            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                {isConnected ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPicker((value) => !value)}
                      disabled={linking || disconnecting}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {repoHref ? 'Change repository' : 'Choose repository'}
                    </Button>
                    <Link
                      href="https://github.com/settings/installations"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-surface-500 hover:text-surface-700 underline underline-offset-2"
                    >
                      Manage access on GitHub
                    </Link>
                  </>
                ) : (
                  <>
                    <Button asChild size="sm" className="btn-primary">
                      <a href={connectHref}>
                        <Github className="w-4 h-4 mr-2" />
                        Connect with GitHub
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing((value) => !value)}
                    >
                      Edit URL
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={linking || disconnecting}
                  className="text-red-600 ml-auto"
                >
                  {disconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  {isConnected ? 'Disconnect' : 'Unlink'}
                </Button>
              </div>
            )}

            {pickerVisible && (
              <div className="space-y-3 rounded-lg border border-surface-100 p-4">
                {reposLoading ? (
                  <div className="flex items-center gap-2 text-sm text-surface-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading repositories from GitHub…
                  </div>
                ) : reposError ? (
                  <div className="space-y-2">
                    <p className="text-sm text-red-600">{reposError}</p>
                    <Button variant="outline" size="sm" onClick={() => void loadRepos()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ) : repos.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-surface-500">
                      This installation does not grant access to any repositories.
                      Add repositories on GitHub, then retry.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => void loadRepos()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="installation-repo">Repository</Label>
                      <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                        <SelectTrigger id="installation-repo">
                          <SelectValue placeholder="Choose a repository" />
                        </SelectTrigger>
                        <SelectContent>
                          {repos.map((repo) => (
                            <SelectItem key={repo.id} value={repo.full_name}>
                              {repo.full_name}
                              {repo.private ? ' (private)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {showPicker && !needsRepoSelection && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowPicker(false)}
                          disabled={linking}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        onClick={handleLinkRepo}
                        disabled={!selectedRepo || linking}
                        className="btn-primary"
                      >
                        {linking ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {linking ? 'Linking…' : 'Link repository'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-surface-500">
              No GitHub repository connected yet. Connect GitHub to authorize the
              repository and install webhooks automatically.
            </p>

            {canManage ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild className="btn-primary">
                  <a href={connectHref}>
                    <Github className="w-4 h-4 mr-2" />
                    Connect with GitHub
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing((value) => !value)}
                >
                  Link a public repo manually
                </Button>
              </div>
            ) : (
              <p className="text-xs text-surface-500">
                Only the room creator or a team leader can connect a repository.
              </p>
            )}
          </>
        )}

        {editing && canManage && (
          <form onSubmit={handleSaveManual} className="space-y-3">
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
              Manual linking stores the URL only. Connect with GitHub above to
              enable automatic webhooks.
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
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? 'Saving…' : 'Link Repository'}
              </Button>
            </div>
          </form>
        )}

        <div className="border-t border-surface-100 pt-3 space-y-2">
          <p className="text-xs font-medium text-surface-700">Agent rules</p>
          <p className="text-xs text-surface-500">
            Download this room&apos;s rules for your IDE agent, then commit the
            file to the repository root.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/rooms/${room.id}/agent-rules`} download>
                <FileDown className="w-4 h-4 mr-2" />
                AGENTS.md
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={`/api/rooms/${room.id}/agent-rules?format=cursorrules`}
                download
              >
                <FileDown className="w-4 h-4 mr-2" />
                .cursorrules
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
