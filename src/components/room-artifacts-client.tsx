'use client';

import * as React from 'react';
import Link from 'next/link';
import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import {
  Plus,
  Search,
  Filter,
  FileImage,
  MoreVertical,
  Edit,
  Trash2,
  Download,
  Eye,
  Check,
  X,
  Zap,
  Image,
  Video,
  FileText,
  Music,
  Code,
  Box,
  List,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Toast, ToastProvider, ToastViewport, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Artifact, RoomMember, User, Room } from '@/types/database';

const ARTIFACT_TYPES = [
  { value: 'document', label: 'Document / Spec', icon: FileText },
  { value: 'apk', label: 'APK Build', icon: Box },
  { value: 'lottie', label: 'Lottie Animation', icon: Code },
  { value: 'riv', label: 'Rive Animation', icon: Code },
  { value: 'presentation', label: 'Presentation', icon: FileText },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'note', label: 'Research Note', icon: FileText },
  { value: 'reference', label: 'Reference Link', icon: FileText },
  { value: 'other', label: 'Other', icon: FileImage },
];

function getTypeIcon(type: string) {
  const t = ARTIFACT_TYPES.find(a => a.value === type);
  return t ? <t.icon className="w-4 h-4" /> : <FileImage className="w-4 h-4" />;
}

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    document: 'bg-indigo-100 text-indigo-800',
    apk: 'bg-green-100 text-green-800',
    lottie: 'bg-purple-100 text-purple-800',
    riv: 'bg-purple-100 text-purple-800',
    presentation: 'bg-blue-100 text-blue-800',
    video: 'bg-red-100 text-red-800',
    image: 'bg-pink-100 text-pink-800',
    note: 'bg-amber-100 text-amber-800',
    reference: 'bg-cyan-100 text-cyan-800',
    other: 'bg-gray-100 text-gray-800',
  };
  return colors[type] || colors.other;
}

interface ArtifactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  onSubmit: (data: FormData) => void;
}

function ArtifactDialog({ open, onOpenChange, roomId, onSubmit }: ArtifactDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<'apk' | 'lottie' | 'riv' | 'presentation' | 'video' | 'image' | 'document' | 'note' | 'reference' | 'other'>('document');
  const [tags, setTags] = React.useState('');
  const [isFinal, setIsFinal] = React.useState(false);
  const [version, setVersion] = React.useState('v1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name || file.name);
    formData.append('type', type);
    formData.append('tags', tags);
    formData.append('is_final', isFinal.toString());
    formData.append('version', version);
    formData.append('room_id', roomId);
    onSubmit(formData);
    onOpenChange(false);
    setFile(null);
    setName('');
    setType('document');
    setTags('');
    setIsFinal(false);
    setVersion('v1');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Artifact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>File</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  if (!name) setName(f.name);
                }
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select onValueChange={setType} defaultValue={type}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ARTIFACT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {getTypeIcon(t.value)}
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Version</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.0.0" />
          </div>

          <div className="space-y-2">
            <Label>Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Leo, Mia, character, v1" />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isFinal}
              onChange={(e) => setIsFinal(e.target.checked)}
              className="rounded border-input"
            />
            <span>Mark as Final Version</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!file}>Upload</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ArtifactPreviewDialog({
  open,
  onOpenChange,
  artifact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifact: Artifact | null;
}) {
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

export function RoomArtifactsClient({ room, initialArtifacts, initialMembers }: {
  room: Room;
  initialArtifacts: (Artifact & { uploader?: User | null })[];
  initialMembers: (RoomMember & { user: User })[];
}) {
  const { user } = useAuthStore();
  const [supabase] = React.useState(() => createClient());
  const [artifacts, setArtifacts] = React.useState(initialArtifacts);
  const [artifactDialogOpen, setArtifactDialogOpen] = React.useState(false);
  const [previewArtifact, setPreviewArtifact] = React.useState<Artifact | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string>('all');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  const filteredArtifacts = artifacts.filter(a => {
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterType !== 'all' && a.type !== filterType) return false;
    return true;
  });

  const handleUploadArtifact = async (formData: FormData) => {
    try {
      const response = await fetch('/api/artifacts', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Could not upload artifact.');
      }

      if (data?.artifact) {
        setArtifacts((prev) => [data.artifact, ...prev]);
      }
      setToast({
        type: 'success',
        title: data?.textExtracted ? 'Artifact indexed' : 'Artifact uploaded',
        message:
          data?.message ||
          `${data?.artifact?.name || 'Artifact'} is ready for MICA and the AI Courtroom.`,
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Could not upload artifact.',
      });
    }
  };

  const handleDeleteArtifact = async (id: string) => {
    if (!confirm('Delete this artifact?')) return;
    setArtifacts(prev => prev.filter(a => a.id !== id));
    try {
      await fetch(`/api/artifacts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete artifact:', error);
    }
  };

  const typeCounts = artifacts.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <ToastProvider>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Header */}
        <div className="border-b border-surface-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-surface-900 dark:text-white">Submission Hub / Artifacts</h1>
              <p className="text-sm text-muted-foreground">{room.name} • {artifacts.length} artifacts</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <FileImage className="w-4 h-4" />}
              </Button>
              <Button asChild className="gap-2">
                <Link href={`/dashboard/artifacts/upload?room=${room.id}`}>
                  <Plus className="w-4 h-4" />
                  Upload
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Type Filter Chips */}
        <div className="border-b border-surface-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] px-6 py-3 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
            >
              All ({artifacts.length})
            </Button>
            {ARTIFACT_TYPES.map(t => (
              <Button
                key={t.value}
                variant={filterType === t.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(t.value)}
              >
                {getTypeIcon(t.value)}
                {t.label} ({typeCounts[t.value] || 0})
              </Button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-b border-surface-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] px-6 py-3 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search artifacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {filteredArtifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
              <FileImage className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">No artifacts found</p>
              <p className="text-sm">Upload APKs, Lottie animations, presentations, and more</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredArtifacts.map(artifact => (
                <Card key={artifact.id} className="overflow-hidden h-full flex flex-col">
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div className={`aspect-video relative ${getTypeColor(artifact.type)} flex items-center justify-center`}>
                      {artifact.type === 'image' && artifact.file_url && (
                        <img src={artifact.file_url} alt={artifact.name} className="max-h-full max-w-full object-contain" />
                      )}
                      {artifact.type !== 'image' && (
                        <div className="text-center p-4">
                          <span className="contents [&>svg]:w-16 [&>svg]:h-16 [&>svg]:mx-auto [&>svg]:mb-2 [&>svg]:opacity-50">{getTypeIcon(artifact.type)}</span>
                          <p className="font-medium text-white">{artifact.type.toUpperCase()}</p>
                        </div>
                      )}
                      {artifact.is_final && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="default"><Check className="w-3 h-3 mr-1" />Final</Badge>
                        </div>
                      )}
                      {(artifact.extracted_text || artifact.content) && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="outline" className="bg-white/90 text-[9px] gap-1 border-indigo-300 text-indigo-800">
                            AI Ready
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn('badge', getTypeColor(artifact.type))}>
                          {getTypeIcon(artifact.type)}
                          {artifact.type}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded hover:bg-muted"><MoreVertical className="w-4 h-4" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setPreviewArtifact(artifact)}>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteArtifact(artifact.id)} className="text-red-600">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-sm font-medium truncate mb-1">{artifact.name}</p>
                      <p className="text-xs text-muted-foreground mb-2">{artifact.version || 'v1'}</p>
                      {(artifact.extracted_text || artifact.content) && (
                        <p className="text-[10px] text-indigo-700 mb-2 line-clamp-2">
                          {(artifact.extracted_text || artifact.content || '').slice(0, 140)}…
                        </p>
                      )}
                      {artifact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {artifact.tags.map(tag => (
                            <span key={tag} className="badge bg-secondary text-xs">{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-auto text-xs text-muted-foreground">
                        <span>{artifact.uploader?.display_name || artifact.uploader?.username || 'Unknown'}</span>
                        <span>{formatRelativeTime(artifact.created_at)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Artifact</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Version</th>
                    <th className="pb-2 pr-4">Tags</th>
                    <th className="pb-2 pr-4">Uploader</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">AI Index</th>
                    <th className="pb-2 pr-4">Created</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArtifacts.map(artifact => (
                    <tr key={artifact.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <span className={cn('w-8 h-8 rounded flex items-center justify-center', getTypeColor(artifact.type))}>
                            {getTypeIcon(artifact.type)}
                          </span>
                          <div>
                            <p className="font-medium">{artifact.name}</p>
                            <p className="text-xs text-muted-foreground">{artifact.version || 'v1'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4"><Badge variant="role" role={getTypeColor(artifact.type).replace('bg-', '').replace(' text-', '')}>{artifact.type}</Badge></td>
                      <td className="py-3 pr-4">{artifact.version || 'v1'}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {artifact.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="badge bg-secondary text-xs">{tag}</span>
                          ))}
                          {artifact.tags.length > 3 && <span className="badge bg-secondary text-xs">+{artifact.tags.length - 3} more</span>}
                        </div>
                      </td>
                      <td className="py-3 pr-4">{artifact.uploader?.display_name || artifact.uploader?.username || 'Unknown'}</td>
                      <td className="py-3 pr-4">{artifact.is_final ? <Badge variant="default"><Check className="w-3 h-3 mr-1" />Final</Badge> : <Badge variant="secondary">Draft</Badge>}</td>
                      <td className="py-3 pr-4">
                        {(artifact.extracted_text || artifact.content) ? (
                          <Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-800">
                            AI Ready
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Binary</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">{formatRelativeTime(artifact.created_at)}</td>
                      <td className="py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded hover:bg-muted"><MoreVertical className="w-4 h-4" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setPreviewArtifact(artifact)}>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteArtifact(artifact.id)} className="text-red-600">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ToastViewport />
      </div>

      {toast && (
        <Toast>
          <ToastTitle>{toast.title}</ToastTitle>
          <ToastDescription>{toast.message}</ToastDescription>
        </Toast>
      )}

      <ArtifactPreviewDialog
        open={previewArtifact !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewArtifact(null);
        }}
        artifact={previewArtifact}
      />
    </ToastProvider>
  );
}
