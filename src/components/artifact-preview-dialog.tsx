'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ExternalLink, FileText } from 'lucide-react';
import type { Artifact } from '@/types/database';

interface ArtifactPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifact: Artifact | null;
}

export function ArtifactPreviewDialog({
  open,
  onOpenChange,
  artifact,
}: ArtifactPreviewDialogProps) {
  if (!artifact) return null;

  const text = String(artifact.extracted_text || artifact.content || '').trim();
  const fileUrl = String(artifact.url || artifact.file_url || '');
  const fileName = String(artifact.file_name || artifact.name || '');
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isImg =
    artifact.type === 'image' ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Artifact Preview</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4">
          {isImg && fileUrl ? (
            <div className="flex flex-col items-center gap-4">
              <img
                src={fileUrl}
                alt={artifact.name}
                className="max-w-full max-h-[60vh] object-contain border rounded-lg shadow-lg"
              />
              <p className="text-sm text-muted-foreground">{fileName}</p>
            </div>
          ) : text ? (
            <div className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-surface-800">
              {text}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
              <p>No preview available</p>
              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-sm underline"
                >
                  Open in new tab
                </a>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          {fileUrl && isImg ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary gap-2 flex items-center"
            >
              <ExternalLink className="w-4 h-4" />
              Open original
            </a>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Client-side listener that opens the dialog when the server-rendered
// "Preview" button dispatches a custom event. This avoids putting 'use client'
// on the entire page while still allowing client-side interactivity.
export function ArtifactPreviewTrigger({
  artifact,
  isImage,
}: {
  artifact: Artifact;
  isImage: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewArtifact, setPreviewArtifact] = useState<Artifact | null>(null);

  const text = String(artifact.extracted_text || artifact.content || '').trim();
  const fileUrl = String(artifact.url || artifact.file_url || '');
  const fileName = String(artifact.file_name || artifact.name || '');
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isImg =
    artifact.type === 'image' ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);

  return (
    <>
      {fileUrl && (
        <button
          onClick={() => {
            setPreviewArtifact(artifact);
            setPreviewOpen(true);
          }}
          className="btn-primary gap-2 flex items-center"
        >
          <FileText className="w-4 h-4" />
          Preview
        </button>
      )}
      <ArtifactPreviewDialog
        open={previewOpen}
        onOpenChange={(open) => {
          if (!open) setPreviewArtifact(null);
          setPreviewOpen(open);
        }}
        artifact={previewArtifact}
      />
    </>
  );
}
