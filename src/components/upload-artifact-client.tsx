'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileImage, Loader2, Plus, UploadCloud } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Artifact } from '@/types/database';

type ArtifactType = Artifact['type'];

const TYPES: { value: ArtifactType; label: string }[] = [
  { value: 'apk', label: 'APK / build' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'lottie', label: 'Lottie animation' },
  { value: 'riv', label: 'Rive animation' },
  { value: 'other', label: 'Other' },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadArtifactClient({
  userId,
  rooms,
  defaultRoomId,
}: {
  userId: string;
  rooms: { id: string; name: string }[];
  defaultRoomId?: string;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [roomId, setRoomId] = useState(
    defaultRoomId && rooms.some((room) => room.id === defaultRoomId)
      ? defaultRoomId
      : rooms[0]?.id || ''
  );
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<ArtifactType>('apk');
  const [version, setVersion] = useState('');
  const [tags, setTags] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tagList = useMemo(
    () =>
      tags
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 12),
    [tags]
  );

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    if (selected && !name) {
      setName(selected.name.replace(/\.[^.]+$/, ''));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!roomId) {
      setError('Choose a room for this artifact.');
      return;
    }
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    if (!name.trim()) {
      setError('Give the artifact a name.');
      return;
    }

    setSaving(true);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${roomId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('artifacts')
        .upload(path, file, {
          cacheControl: '3600',
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrl } = supabase.storage.from('artifacts').getPublicUrl(path);

      // The artifacts bucket is private, so store a long-lived signed URL
      // instead of an unusable public URL.
      const { data: signed } = await supabase.storage
        .from('artifacts')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      const fileUrl = signed?.signedUrl || publicUrl.publicUrl;

      const { error: insertError } = await supabase.from('artifacts').insert({
        room_id: roomId,
        uploaded_by: userId,
        name: name.trim(),
        type,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type || null,
        tags: tagList,
        version: version.trim() || null,
        is_final: isFinal,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      router.push(`/dashboard/rooms/${roomId}/artifacts`);
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'Could not upload the artifact.'
      );
      setSaving(false);
    }
  }

  if (rooms.length === 0) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto">
        <FileImage className="w-14 h-14 mx-auto text-surface-300" />
        <h1 className="text-xl font-bold text-surface-900 mt-4">Create a room first</h1>
        <p className="text-surface-500 mt-2">
          Artifacts live inside a room. Create a room, then upload your builds and designs.
        </p>
        <Link href="/dashboard/rooms/new" className="btn-primary mt-6">
          <Plus className="w-4 h-4" />
          Create a room
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/dashboard/artifacts" className="btn-ghost w-fit">
        <ArrowLeft className="w-4 h-4" />
        Back to artifacts
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-surface-900">Upload artifact</h1>
        <p className="text-surface-600 mt-1">Share a build, design or deliverable with your room.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label htmlFor="room" className="label">
            Room
          </label>
          <select
            id="room"
            className="input"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            required
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="file" className="label">
            File
          </label>
          <label
            htmlFor="file"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-300 bg-surface-50 px-6 py-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 transition-colors"
          >
            <UploadCloud className="w-7 h-7 text-primary-600" />
            <span className="text-sm font-medium text-surface-800">
              {file ? file.name : 'Click to choose a file'}
            </span>
            <span className="text-xs text-surface-500">
              {file ? formatBytes(file.size) : 'APK, images, videos, presentations and more'}
            </span>
            <input id="file" type="file" className="hidden" onChange={handleFile} />
          </label>
        </div>

        <div>
          <label htmlFor="name" className="label">
            Artifact name
          </label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Demo build v2"
            maxLength={140}
            required
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="label">
              Type
            </label>
            <select
              id="type"
              className="input"
              value={type}
              onChange={(event) => setType(event.target.value as ArtifactType)}
            >
              {TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="version" className="label">
              Version
            </label>
            <input
              id="version"
              className="input"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="e.g. 1.2.0"
              maxLength={30}
            />
          </div>
        </div>

        <div>
          <label htmlFor="tags" className="label">
            Tags
          </label>
          <input
            id="tags"
            className="input"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="demo, android, final (comma separated)"
          />
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tagList.map((tag) => (
                <span key={tag} className="text-xs text-primary-600">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-surface-200 p-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={isFinal}
            onChange={(event) => setIsFinal(event.target.checked)}
          />
          <span>
            <span className="text-sm font-medium text-surface-900 block">Mark as final</span>
            <span className="text-xs text-surface-500">
              Use this for the version the team should present or ship.
            </span>
          </span>
        </label>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/dashboard/artifacts" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {saving ? 'Uploading…' : 'Upload artifact'}
          </button>
        </div>
      </form>
    </div>
  );
}
