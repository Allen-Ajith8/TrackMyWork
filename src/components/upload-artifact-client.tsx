'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileImage,
  FileText,
  Link2,
  Loader2,
  NotebookPen,
  Plus,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import type { ArtifactType } from '@/types/database';

type UploadMode = 'file' | 'note' | 'reference';

const TYPES: { value: ArtifactType; label: string }[] = [
  { value: 'document', label: 'Document / spec / rules' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'apk', label: 'APK / build' },
  { value: 'lottie', label: 'Lottie animation' },
  { value: 'riv', label: 'Rive animation' },
  { value: 'other', label: 'Other' },
];

const DOCUMENT_ACCEPT =
  '.md,.markdown,.txt,.pdf,.json,.csv,.tsv,.yaml,.yml,.toml,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.go,.rs,.java,.kt,.swift,.c,.cpp,.h,.hpp,.cs,.php,.rb,.sql,.sh,.log,.doc,.docx,.ppt,.pptx,.key';

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
  const [mode, setMode] = useState<UploadMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<ArtifactType>('document');
  const [version, setVersion] = useState('');
  const [tags, setTags] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
    if (selected) {
      if (!name) {
        setName(selected.name.replace(/\.[^.]+$/, ''));
      }
      const extension = selected.name.split('.').pop()?.toLowerCase() || '';
      if (['md', 'markdown', 'txt', 'pdf', 'json', 'csv', 'yaml', 'yml', 'xml', 'sql'].includes(extension)) {
        setType('document');
      }
    }
  }

  function switchMode(nextMode: UploadMode) {
    setMode(nextMode);
    setError(null);
    setStatus(null);
    if (nextMode === 'file') {
      setType('document');
    } else if (nextMode === 'note') {
      setType('note');
    } else {
      setType('reference');
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!roomId) {
      setError('Choose a room for this artifact.');
      return;
    }
    if (mode === 'file' && !file) {
      setError('Choose a file to upload.');
      return;
    }
    if (!name.trim()) {
      setError(mode === 'file' ? 'Give the artifact a name.' : 'Give the note or reference a title.');
      return;
    }
    if (mode !== 'file' && !noteContent.trim() && !referenceUrl.trim()) {
      setError('Add text content or a reference URL.');
      return;
    }

    setSaving(true);

    try {
      if (mode === 'file' && file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('room_id', roomId);
        formData.append('name', name.trim());
        formData.append('type', type);
        formData.append('tags', tags);
        formData.append('version', version.trim());
        formData.append('is_final', String(isFinal));

        setStatus('Uploading and extracting searchable text…');
        const response = await fetch('/api/artifacts', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Could not upload the artifact.');
        }
        if (data?.warning) {
          setStatus(String(data.warning));
        }
      } else {
        setStatus('Indexing the note for MICA and the Courtroom…');
        const response = await fetch('/api/artifacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_id: roomId,
            name: name.trim(),
            type: mode === 'reference' ? 'reference' : 'note',
            kind: mode,
            content: noteContent.trim(),
            url: referenceUrl.trim(),
            tags: tagList,
            version: version.trim() || null,
            is_final: isFinal,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Could not save the artifact.');
        }
      }

      router.push(`/dashboard/rooms/${roomId}/artifacts`);
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'Could not save the artifact.'
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
        <h1 className="text-2xl font-bold text-surface-900">Add room artifact</h1>
        <p className="text-surface-600 mt-1">
          Upload a document, or save a note/reference. Text is indexed so MICA and the AI Courtroom
          can cite it.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border bg-surface-50 p-1.5">
        {[
          { id: 'file' as const, label: 'Upload file', icon: UploadCloud },
          { id: 'note' as const, label: 'Add note', icon: NotebookPen },
          { id: 'reference' as const, label: 'Add reference', icon: Link2 },
        ].map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => switchMode(option.id)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                mode === option.id
                  ? 'bg-white text-primary-700 shadow-sm border border-surface-200'
                  : 'text-surface-600 hover:bg-white/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {option.label}
            </button>
          );
        })}
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

        {mode === 'file' && (
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
                {file ? formatBytes(file.size) : 'rules.md, PDFs, specs, code, notes and more'}
              </span>
              <input
                id="file"
                type="file"
                className="hidden"
                accept={DOCUMENT_ACCEPT}
                onChange={handleFile}
              />
            </label>
            <p className="mt-2 text-[11px] text-surface-500 flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
              Markdown, TXT, JSON, CSV, code and PDF files have their text extracted server-side and
              saved for MICA and Courtroom grounding.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="name" className="label">
            {mode === 'file' ? 'Artifact name' : 'Title'}
          </label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              mode === 'file'
                ? 'e.g. rules.md or Demo build v2'
                : mode === 'note'
                ? 'e.g. Research notes: RAG benchmarks'
                : 'e.g. Official hackathon rules page'
            }
            maxLength={140}
            required
          />
        </div>

        {mode !== 'file' && (
          <>
            <div>
              <label htmlFor="content" className="label">
                Content
              </label>
              <textarea
                id="content"
                className="input min-h-[150px] font-mono text-xs"
                value={noteContent}
                onChange={(event) => setNoteContent(event.target.value)}
                placeholder={
                  mode === 'note'
                    ? 'Paste the research notes, constraints, benchmark results or spec text here…'
                    : 'Optional excerpt or summary of the reference…'
                }
              />
            </div>
            {mode === 'reference' && (
              <div>
                <label htmlFor="url" className="label">
                  Reference URL
                </label>
                <input
                  id="url"
                  className="input font-mono text-xs"
                  value={referenceUrl}
                  onChange={(event) => setReferenceUrl(event.target.value)}
                  placeholder="https://arxiv.org/abs/..."
                  type="url"
                />
              </div>
            )}
          </>
        )}

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
              {mode === 'file' ? (
                TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))
              ) : (
                <option value={mode === 'reference' ? 'reference' : 'note'}>
                  {mode === 'reference' ? 'Reference' : 'Note'}
                </option>
              )}
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
            placeholder="rules, rubric, research, benchmark (comma separated)"
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
        {status && !error && (
          <div className="rounded-lg px-4 py-3 text-sm bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {status}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/dashboard/artifacts" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {saving ? 'Indexing…' : mode === 'file' ? 'Upload artifact' : 'Save artifact'}
          </button>
        </div>
      </form>
    </div>
  );
}
