'use client';

import * as React from 'react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
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
  { value: 'apk', label: 'APK Build', icon: Box },
  { value: 'lottie', label: 'Lottie Animation', icon: Code },
  { value: 'riv', label: 'Rive Animation', icon: Code },
  { value: 'presentation', label: 'Presentation', icon: FileText },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'other', label: 'Other', icon: FileImage },
];

function getTypeIcon(type: string) {
  const t = ARTIFACT_TYPES.find(a => a.value === type);
  return t ? <t.icon className="w-4 h-4" /> : <FileImage className="w-4 h-4" />;
}

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    apk: 'bg-green-100 text-green-800',
    lottie: 'bg-purple-100 text-purple-800',
    riv: 'bg-purple-100 text-purple-800',
    presentation: 'bg-blue-100 text-blue-800',
    video: 'bg-red-100 text-red-800',
    image: 'bg-pink-100 text-pink-800',
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
  const [type, setType] = React.useState<'apk' | 'lottie' | 'riv' | 'presentation' | 'video' | 'image' | 'other'>('other');
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
    setType('other');
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

export function RoomArtifactsClient({ room, initialArtifacts, initialMembers }: {
  room: Room;
  initialArtifacts: (Artifact & { uploader?: User | null })[];
  initialMembers: (RoomMember & { user: User })[];
}) {
  const { user } = useAuthStore();
  const [artifacts, setArtifacts] = React.useState(initialArtifacts);
  const [artifactDialogOpen, setArtifactDialogOpen] = React.useState(false);
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
    // TODO: Upload to Supabase Storage
    // For now, create optimistic artifact
    const newArtifact: Artifact = {
      id: crypto.randomUUID(),
      room_id: room.id,
      uploaded_by: user?.id || '',
      name: formData.get('name') as string,
      type: formData.get('type') as Artifact['type'],
      file_url: '', // Would be set after upload
      file_size: 0,
      mime_type: '',
      tags: (formData.get('tags') as string).split(',').map(t => t.trim()).filter(Boolean),
      version: formData.get('version') as string,
      is_final: formData.get('is_final') === 'true',
      canva_design_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setArtifacts(prev => [newArtifact, ...prev]);
    setToast({ type: 'success', title: 'Upload Started', message: `${newArtifact.name} is being uploaded` });
  };

  const handleDeleteArtifact = async (id: string) => {
    if (!confirm('Delete this artifact?')) return;
    setArtifacts(prev => prev.filter(a => a.id !== id));
    try {
      const supabase = createClient();
      await supabase.from('artifacts').delete().eq('id', id);
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
        <div className="border-b bg-white px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Submission Hub / Artifacts</h1>
              <p className="text-sm text-muted-foreground">{room.name} • {artifacts.length} artifacts</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <FileImage className="w-4 h-4" />}
              </Button>
              <Button onClick={() => setArtifactDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Upload
              </Button>
              <ArtifactDialog
                open={artifactDialogOpen}
                onOpenChange={setArtifactDialogOpen}
                roomId={room.id}
                onSubmit={handleUploadArtifact}
              />
            </div>
          </div>
        </div>

        {/* Type Filter Chips */}
        <div className="border-b bg-white px-6 py-3 flex-shrink-0">
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
        <div className="border-b bg-white px-6 py-3 flex-shrink-0">
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
                            <DropdownMenuItem onClick={() => {}}>View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>Download</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteArtifact(artifact.id)} className="text-red-600">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-sm font-medium truncate mb-1">{artifact.name}</p>
                      <p className="text-xs text-muted-foreground mb-2">{artifact.version || 'v1'}</p>
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
                      <td className="py-3 pr-4">{formatRelativeTime(artifact.created_at)}</td>
                      <td className="py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded hover:bg-muted"><MoreVertical className="w-4 h-4" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {}}>View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>Download</DropdownMenuItem>
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
    </ToastProvider>
  );
}
