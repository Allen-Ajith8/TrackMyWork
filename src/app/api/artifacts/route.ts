import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerAuthUser } from '@/lib/dashboard-data';
import { isSupabaseConfiguredForData } from '@/lib/supabase-config';
import {
  detectArtifactType,
  extractArtifactText,
  isPdfFile,
  isTextLikeFile,
} from '@/lib/artifact-text';
import {
  listRememberedArtifacts,
  rememberArtifact,
  removeRememberedArtifact,
  removeRememberedArtifactEverywhere,
} from '@/lib/artifact-store';
import type { Artifact, ArtifactKind, ArtifactType } from '@/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const BUCKET = 'artifacts';

const ALLOWED_TYPES = new Set<ArtifactType>([
  'apk',
  'lottie',
  'riv',
  'presentation',
  'video',
  'image',
  'document',
  'note',
  'reference',
  'other',
]);

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim().replace(/^#/, '')).filter(Boolean).slice(0, 12);
  }
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 12);
}

function asArtifactType(value: unknown, fallback: ArtifactType): ArtifactType {
  const type = String(value || '').trim().toLowerCase() as ArtifactType;
  return ALLOWED_TYPES.has(type) ? type : fallback;
}

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    message.includes('column') ||
    message.includes('schema cache')
  );
}

function createLocalArtifact(payload: Record<string, unknown>): Artifact {
  const now = new Date().toISOString();
  return {
    id: `demo-art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    room_id: String(payload.room_id || ''),
    uploaded_by: String(payload.uploaded_by || 'demo-dev-user-001'),
    name: String(payload.name || 'Untitled artifact'),
    type: (payload.type as ArtifactType) || 'other',
    file_url: String(payload.file_url || ''),
    file_name: (payload.file_name as string) || null,
    storage_path: (payload.storage_path as string) || null,
    file_size: Number(payload.file_size || 0) || null,
    mime_type: (payload.mime_type as string) || null,
    content: (payload.content as string) || null,
    extracted_text: (payload.extracted_text as string) || null,
    kind: (payload.kind as ArtifactKind) || 'file',
    scope: (payload.scope as string) || 'room',
    url: (payload.url as string) || null,
    metadata: (payload.metadata as Record<string, unknown>) || {},
    tags: (payload.tags as string[]) || [],
    version: (payload.version as string) || null,
    is_final: Boolean(payload.is_final),
    canva_design_id: null,
    created_at: now,
    updated_at: now,
  };
}

async function insertArtifact(payload: Record<string, unknown>): Promise<{
  artifact: Artifact | null;
  warning?: string;
}> {
  const admin = createAdminClient();
  const full = await admin.from('artifacts').insert(payload).select('*').single();

  if (!full.error && full.data) {
    return { artifact: full.data as Artifact };
  }

  if (!isMissingColumnError(full.error)) {
    throw new Error(full.error?.message || 'Could not save artifact.');
  }

  // Older deployments may not have the new text columns yet. Save the core
  // row first, then try to attach extracted text separately.
  const baseKeys = [
    'room_id',
    'uploaded_by',
    'name',
    'type',
    'file_url',
    'file_size',
    'mime_type',
    'tags',
    'version',
    'is_final',
    'canva_design_id',
  ];
  const basePayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => baseKeys.includes(key))
  );

  const base = await admin.from('artifacts').insert(basePayload).select('*').single();
  if (base.error || !base.data) {
    throw new Error(base.error?.message || 'Could not save artifact.');
  }

  const extraKeys = [
    'file_name',
    'storage_path',
    'content',
    'extracted_text',
    'kind',
    'scope',
    'url',
    'metadata',
  ];
  const extraPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => extraKeys.includes(key))
  );

  let warning =
    'Artifact saved, but this Supabase project is missing the searchable-text columns. Run supabase/migrations/20261122_room_artifacts_context.sql to enable AI grounding.';

  if (Object.keys(extraPayload).length > 0) {
    const updated = await admin
      .from('artifacts')
      .update(extraPayload)
      .eq('id', base.data.id)
      .select('*')
      .single();
    if (!updated.error && updated.data) {
      return { artifact: updated.data as Artifact };
    }
  }

  return { artifact: base.data as Artifact, warning };
}

async function handleUpload(request: NextRequest, userId: string) {
  const form = await request.formData();
  const roomId = String(form.get('room_id') || form.get('roomId') || '').trim();
  const file = form.get('file');

  if (!roomId) {
    return NextResponse.json({ error: 'room_id is required.' }, { status: 400 });
  }
  if (!file || typeof file === 'string' || !('arrayBuffer' in file)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
  }

  const upload = file as File;
  if (upload.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File is too large. The limit is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` },
      { status: 413 }
    );
  }

  const allowedExtensions = new Set([
    'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png',
  ]);
  const fileExt = upload.name.split('.').pop()?.toLowerCase() || '';
  if (!allowedExtensions.has(fileExt)) {
    return NextResponse.json(
      { error: `File type "${fileExt}" is not allowed. Only PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, JPEG and PNG files are accepted.` },
      { status: 400 }
    );
  }

  const originalName = upload.name || 'artifact';
  const buffer = Buffer.from(await upload.arrayBuffer());
  const mimeType = upload.type || null;
  const displayName =
    String(form.get('name') || form.get('title') || originalName).trim() || originalName;
  const detectedType = detectArtifactType(originalName, mimeType);
  const requestedType = String(form.get('type') || '').trim();
  const type =
    requestedType && requestedType !== 'other'
      ? asArtifactType(requestedType, detectedType)
      : detectedType;
  const tags = parseTags(form.get('tags'));
  const version = String(form.get('version') || '').trim() || null;
  const isFinal = String(form.get('is_final') || '').toLowerCase() === 'true';
  const scope = String(form.get('scope') || 'room').trim() === 'workspace' ? 'workspace' : 'room';

  const extraction = await extractArtifactText({
    buffer,
    fileName: originalName,
    mimeType,
  });

  let fileUrl = '';
  let storagePath: string | null = null;
  let storageWarning: string | undefined;

  if (isSupabaseConfiguredForData()) {
    try {
      const admin = createAdminClient();
      const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = `${roomId}/${Date.now()}-${safeName}`;

      const uploaded = await admin.storage.from(BUCKET).upload(storagePath, new Uint8Array(buffer) as any, {
        cacheControl: '3600',
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });

      if (uploaded.error) {
        storageWarning = `File storage failed: ${uploaded.error.message}`;
        storagePath = null;
      } else {
        const signed = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 365);
        const publicUrl = admin.storage.from(BUCKET).getPublicUrl(storagePath);
        fileUrl = signed.data?.signedUrl || publicUrl.data.publicUrl || '';
      }
    } catch (error) {
      storageWarning = error instanceof Error ? error.message : 'File storage failed.';
      storagePath = null;
    }
  }

  const payload: Record<string, unknown> = {
    room_id: roomId,
    uploaded_by: userId,
    name: displayName,
    type,
    file_url: fileUrl,
    file_name: originalName,
    storage_path: storagePath,
    file_size: upload.size,
    mime_type: mimeType,
    content: extraction.text || null,
    extracted_text: extraction.text || null,
    kind: 'file' satisfies ArtifactKind,
    scope,
    url: fileUrl || null,
    metadata: {
      originalName,
      extractionSource: extraction.source,
      textChars: extraction.text.length,
      hasExtractedText: Boolean(extraction.text),
      uploadedVia: 'api/artifacts',
    },
    tags,
    version,
    is_final: isFinal,
  };

  const { artifact, warning } = isSupabaseConfiguredForData()
    ? await insertArtifact(payload)
    : { artifact: createLocalArtifact(payload), warning: undefined };
  if (!artifact) {
    return NextResponse.json({ error: 'Could not save artifact.' }, { status: 500 });
  }

  rememberArtifact(artifact);

  const extractionNote = isPdfFile(originalName, mimeType)
    ? extraction.text
      ? `Extracted ${extraction.text.length.toLocaleString()} characters from the PDF for AI grounding.`
      : 'The PDF was saved, but no selectable text could be extracted (it may be a scanned image).'
    : isTextLikeFile(originalName, mimeType)
    ? extraction.text
      ? `Saved ${extraction.text.length.toLocaleString()} characters of text for AI grounding.`
      : 'The file was saved, but it was empty.'
    : 'Binary artifact saved. AI grounding will use its title, type and tags.';

  return NextResponse.json({
    success: true,
    artifact,
    textExtracted: Boolean(extraction.text),
    extractionSource: extraction.source,
    message: extractionNote,
    warning: warning || storageWarning || null,
  });
}

async function handleNote(request: NextRequest, userId: string) {
  const body = await request.json().catch(() => ({}));
  const roomId = String(body?.room_id || body?.roomId || '').trim();
  const title = String(body?.name || body?.title || '').trim();
  const content = String(body?.content || body?.text || '').trim();
  const url = String(body?.url || '').trim();
  const tags = parseTags(body?.tags);
  const version = String(body?.version || '').trim() || null;
  const scope = String(body?.scope || 'room').trim() === 'workspace' ? 'workspace' : 'room';
  const requestedKind = String(body?.kind || '').trim().toLowerCase();
  const kind: ArtifactKind =
    requestedKind === 'reference' || requestedKind === 'link' || (!content && url)
      ? 'reference'
      : 'note';
  const fallbackType: ArtifactType = kind === 'reference' ? 'reference' : 'note';
  const type = asArtifactType(body?.type, fallbackType);

  if (!roomId) {
    return NextResponse.json({ error: 'room_id is required.' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: 'A title is required.' }, { status: 400 });
  }
  if (!content && !url) {
    return NextResponse.json(
      { error: 'Add text content or a reference URL.' },
      { status: 400 }
    );
  }

  const text = content || `Reference link: ${url}`;
  const payload: Record<string, unknown> = {
    room_id: roomId,
    uploaded_by: userId,
    name: title,
    type,
    file_url: url,
    file_name: title,
    storage_path: null,
    file_size: Buffer.byteLength(text, 'utf8'),
    mime_type: url ? 'text/uri-list' : 'text/markdown',
    content: text,
    extracted_text: text,
    kind,
    scope,
    url: url || null,
    metadata: {
      textChars: text.length,
      hasExtractedText: true,
      uploadedVia: 'api/artifacts',
      source: kind,
    },
    tags,
    version,
    is_final: Boolean(body?.is_final),
  };

  const { artifact, warning } = isSupabaseConfiguredForData()
    ? await insertArtifact(payload)
    : { artifact: createLocalArtifact(payload), warning: undefined };
  if (!artifact) {
    return NextResponse.json({ error: 'Could not save artifact.' }, { status: 500 });
  }

  rememberArtifact(artifact);

  return NextResponse.json({
    success: true,
    artifact,
    textExtracted: true,
    message: `${kind === 'reference' ? 'Reference' : 'Note'} saved and indexed for MICA and the AI Courtroom.`,
    warning: warning || null,
  });
}

export async function GET(request: NextRequest) {
  const roomId = String(
    request.nextUrl.searchParams.get('room_id') ||
      request.nextUrl.searchParams.get('roomId') ||
      ''
  ).trim();

  if (!roomId) {
    return NextResponse.json({ error: 'room_id is required.' }, { status: 400 });
  }

  if (!isSupabaseConfiguredForData()) {
    return NextResponse.json({
      artifacts: listRememberedArtifacts(roomId),
      source: 'demo',
    });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('artifacts')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({
        artifacts: listRememberedArtifacts(roomId),
        source: 'memory',
        warning: error.message,
      });
    }

    const remembered = listRememberedArtifacts(roomId);
    const merged = [
      ...remembered,
      ...((data || []) as Artifact[]).filter(
        (artifact) => !remembered.some((item) => item.id === artifact.id)
      ),
    ];

    return NextResponse.json({ artifacts: merged, source: 'supabase' });
  } catch (error) {
    return NextResponse.json({
      artifacts: listRememberedArtifacts(roomId),
      source: 'memory',
      warning: error instanceof Error ? error.message : 'Could not load artifacts.',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getServerAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      return await handleUpload(request, user.id);
    }

    return await handleNote(request, user.id);
  } catch (error) {
    console.error('[api/artifacts] POST failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save artifact.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const id = String(
      request.nextUrl.searchParams.get('id') || request.nextUrl.searchParams.get('artifact_id') || ''
    ).trim();
    if (!id) {
      return NextResponse.json({ error: 'Artifact id is required.' }, { status: 400 });
    }

    if (isSupabaseConfiguredForData()) {
      const admin = createAdminClient();
      const { data } = await admin.from('artifacts').select('*').eq('id', id).maybeSingle();
      const artifact = data as Artifact | null;

      if (artifact?.storage_path) {
        await admin.storage.from(BUCKET).remove([artifact.storage_path]);
      }

      const { error } = await admin.from('artifacts').delete().eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (artifact?.room_id) {
        removeRememberedArtifact(artifact.room_id, id);
      }
    }

    removeRememberedArtifactEverywhere(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not delete artifact.' },
      { status: 500 }
    );
  }
}
