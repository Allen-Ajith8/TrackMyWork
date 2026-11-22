-- ============================================================================
-- TrackMyWork - Migration: Searchable Room Artifacts
-- ============================================================================
-- Stores extracted text for documents (rules.md, PDFs, specs, notes) so MICA
-- and the AI Courtroom can ground answers without downloading binaries.
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.artifacts
    ADD COLUMN IF NOT EXISTS file_name TEXT,
    ADD COLUMN IF NOT EXISTS storage_path TEXT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT,
    ADD COLUMN IF NOT EXISTS content TEXT,
    ADD COLUMN IF NOT EXISTS extracted_text TEXT,
    ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'file',
    ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'room',
    ADD COLUMN IF NOT EXISTS url TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Existing rows are room-scoped files.
UPDATE public.artifacts
SET kind = COALESCE(NULLIF(kind, ''), 'file'),
    scope = COALESCE(NULLIF(scope, ''), 'room'),
    metadata = COALESCE(metadata, '{}'::jsonb)
WHERE kind IS NULL OR kind = '' OR scope IS NULL OR scope = '' OR metadata IS NULL;

CREATE INDEX IF NOT EXISTS idx_artifacts_room_created
    ON public.artifacts(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_artifacts_scope
    ON public.artifacts(scope);

-- Fast case-insensitive lookups for rulebooks and reference material.
CREATE INDEX IF NOT EXISTS idx_artifacts_name_lower
    ON public.artifacts(lower(name));

COMMENT ON COLUMN public.artifacts.content IS
    'Full plain-text content for notes, links and small text artifacts.';
COMMENT ON COLUMN public.artifacts.extracted_text IS
    'Server-extracted text for uploaded files (Markdown, TXT, PDF, code).';
COMMENT ON COLUMN public.artifacts.kind IS
    'file | note | reference | link';
COMMENT ON COLUMN public.artifacts.scope IS
    'room | workspace';
