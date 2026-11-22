import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, FileText, Sparkles, Upload } from 'lucide-react';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { getFallbackDemoRoom, getServerAuthUser, isSupabaseConfigured } from '@/lib/dashboard-data';
import { formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Artifact } from '@/types/database';
import { ArtifactPreviewTrigger } from '@/components/artifact-preview-dialog';

export const dynamic = 'force-dynamic';

export default async function ArtifactDetailPage({
  params,
}: {
  params: Promise<{ id: string; artifactId: string }>;
}) {
  const { id: roomId, artifactId } = await params;
  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);

  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${roomId}/artifacts/${artifactId}`);
  }

  let artifact: Artifact | null = null;
  let roomName = 'Room';

  if (isSupabaseConfigured()) {
    try {
      const [{ data: artifactData }, { data: roomData }] = await Promise.all([
        supabase.from('artifacts').select('*').eq('id', artifactId).maybeSingle(),
        supabase.from('rooms').select('name').eq('id', roomId).maybeSingle(),
      ]);
      artifact = (artifactData as Artifact | null) || null;
      roomName = String((roomData as { name?: string } | null)?.name || roomName);
    } catch {
      artifact = null;
    }
  }

  // Demo / offline fallback: look up the artifact in the fallback demo room data
  if (!artifact && !isSupabaseConfigured()) {
    try {
      const demo = getFallbackDemoRoom(roomId);
      const demoArtifact = demo.artifacts.find((a) => a.id === artifactId) as Artifact | undefined;
      if (demoArtifact) {
        artifact = demoArtifact;
        roomName = demo.room.name;
      }
    } catch {
      artifact = null;
    }
  }

  if (!artifact) {
    notFound();
  }

  const text = String(artifact.extracted_text || artifact.content || '').trim();
  const fileUrl = String(artifact.url || artifact.file_url || '');
  const isImage =
    artifact.type === 'image' ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(
      String(artifact.file_name || '').split('.').pop()?.toLowerCase() || ''
    );

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <Link href={`/dashboard/rooms/${roomId}/artifacts`} className="btn-ghost w-fit">
        <ArrowLeft className="w-4 h-4" />
        Back to {roomName} artifacts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-surface-900">{artifact.name}</h1>
            <Badge variant="secondary">{artifact.type}</Badge>
            {artifact.kind && <Badge variant="outline">{artifact.kind}</Badge>}
            {text && (
              <Badge className="bg-indigo-600 text-white gap-1">
                <Sparkles className="w-3 h-3" />
                AI Ready
              </Badge>
            )}
          </div>
          <p className="text-xs text-surface-500 mt-1">
            {artifact.file_name || artifact.name} · {artifact.version || 'v1'} · uploaded{' '}
            {formatRelativeTime(artifact.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/artifacts/upload?room=${roomId}`}
            className="btn-outline gap-2 flex items-center"
          >
            <Upload className="w-4 h-4" />
            Upload Artifact
          </Link>
        </div>
      </div>

      {artifact.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {artifact.tags.map((tag) => (
            <span key={tag} className="badge bg-secondary text-xs">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center gap-2 pb-3 border-b">
          <FileText className="w-4 h-4 text-primary-600" />
          <h2 className="text-sm font-bold">Searchable text used by MICA &amp; the AI Courtroom</h2>
          {text && (
            <span className="text-[11px] text-muted-foreground ml-auto">
              {text.length.toLocaleString()} characters
            </span>
          )}
        </div>
        {text ? (
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-surface-800 max-h-[65vh] overflow-y-auto">
            {text}
          </pre>
        ) : (
          <div className="py-10 text-center text-sm text-surface-500">
            <FileText className="w-10 h-10 mx-auto text-surface-300" />
            <p className="mt-2 font-medium text-surface-700">No searchable text stored</p>
            <p className="text-xs mt-1">
              This may be a binary artifact, a scanned PDF, or an older upload. Re-upload it to
              extract text for AI grounding.
            </p>
          </div>
        )}
      </div>

      <ArtifactPreviewTrigger artifact={artifact} isImage={isImage} />
    </div>
  );
}
