'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useRoomStore, useTaskStore, useVibeStore } from '@/lib/store';
import {
  Plus,
  Search,
  Filter,
  Kanban,
  List,
  Settings,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Clock,
  Package,
  FileImage,
  Users,
  Eye,
  Edit,
  Trash2,
  ArrowRight,
  Zap,
  HeartPulse,
  Wifi,
  WifiOff,
  Github,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { formatRelativeTime, cn, getTaskStatusColor, getBomStatusColor, getRoleColor } from '@/lib/utils';
import type { Task, TaskStatus, TaskCategory, HardwareBomItem, BomStatus, Artifact, RoomMember, User, Room } from '@/types/database';

const STATUS_COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'bg-gray-100' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-100' },
  { id: 'review', label: 'Review', color: 'bg-yellow-100' },
  { id: 'done', label: 'Done', color: 'bg-green-100' },
  { id: 'blocked', label: 'Blocked', color: 'bg-red-100' },
];

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  code: 'bg-blue-500',
  hardware: 'bg-amber-500',
  animation: 'bg-purple-500',
  design: 'bg-pink-500',
  docs: 'bg-gray-500',
  pitch: 'bg-orange-500',
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  code: 'Code',
  hardware: 'Hardware',
  animation: 'Animation',
  design: 'Design',
  docs: 'Docs',
  pitch: 'Pitch',
};

interface TaskCardProps {
  task: Task & { assignee?: User | null };
  members: (RoomMember & { user: User })[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

function TaskCard({ task, members, onUpdate, onDelete }: TaskCardProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  const assignee = task.assigned_to ? members.find(m => m.user_id === task.assigned_to) : null;

  return (
    <div className="bg-white rounded-lg border shadow-sm p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <span className={cn('badge', getTaskStatusColor(task.status))}>{task.status.replace('_', ' ')}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-muted">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onUpdate(task.id, { status: 'todo' })}>Mark as To Do</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdate(task.id, { status: 'in_progress' })}>Mark In Progress</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdate(task.id, { status: 'review' })}>Mark for Review</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdate(task.id, { status: 'done' })}>Mark Done</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdate(task.id, { status: 'blocked' })}>Mark Blocked</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h4 className="font-medium text-sm mb-1">{task.title}</h4>
      {task.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{task.description}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('badge bg-secondary', CATEGORY_COLORS[task.category])}>{CATEGORY_LABELS[task.category]}</span>
        {task.due_date && (
          <span className={cn('badge', new Date(task.due_date) < new Date() && task.status !== 'done' ? 'bg-red-100 text-red-800' : 'bg-secondary')}>
            <Clock className="w-3 h-3 mr-1" />
            {formatRelativeTime(task.due_date)}
          </span>
        )}
      </div>
      {assignee && (
        <div className="mt-2 flex items-center gap-1">
          <Avatar className="h-5 w-5" src={assignee.user.avatar_url} fallback={assignee.user.display_name || assignee.user.username || assignee.user.email} />
          <span className="text-xs text-muted-foreground">{assignee.user.display_name || assignee.user.username}</span>
        </div>
      )}
    </div>
  );
}

interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  members: (RoomMember & { user: User })[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}

function KanbanColumn({ status, label, tasks, members, onUpdateTask, onDeleteTask }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-72 max-h-[calc(100vh-300px)] flex flex-col">
      <div className="flex items-center justify-between p-2">
        <h3 className="font-semibold text-sm">{label}</h3>
        <span className="badge bg-secondary">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-muted/30 rounded-lg min-h-[200px]">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            members={members}
            onUpdate={onUpdateTask}
            onDelete={onDeleteTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center text-muted-foreground py-8 text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: (RoomMember & { user: User })[];
  roomId: string;
  onSubmit: (data: Partial<Task>) => void;
  editingTask?: Task | null;
}

function TaskDialog({ open, onOpenChange, members, roomId, onSubmit, editingTask }: TaskDialogProps) {
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    status: 'todo' as TaskStatus,
    category: 'code' as TaskCategory,
    assigned_to: '',
    priority: 0,
    due_date: '',
  });

  React.useEffect(() => {
    if (editingTask) {
      setFormData({
        title: editingTask.title,
        description: editingTask.description || '',
        status: editingTask.status,
        category: editingTask.category,
        assigned_to: editingTask.assigned_to || '',
        priority: editingTask.priority,
        due_date: editingTask.due_date ? new Date(editingTask.due_date).toISOString().split('T')[0] : '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'todo',
        category: 'code',
        assigned_to: '',
        priority: 0,
        due_date: '',
      });
    }
  }, [editingTask, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      room_id: roomId,
      assigned_to: formData.assigned_to || null,
      due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      priority: Number(formData.priority) || 0,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                onValueChange={(v: string) => setFormData({ ...formData, status: v as TaskStatus })}
                defaultValue={formData.status}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_COLUMNS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                onValueChange={(v: string) => setFormData({ ...formData, category: v as TaskCategory })}
                defaultValue={formData.category}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map(c => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select
              onValueChange={(v: string) => setFormData({ ...formData, assigned_to: v })}
              defaultValue={formData.assigned_to}
            >
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.user.display_name || m.user.username || m.user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                min="0"
                max="10"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editingTask ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface BomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: (RoomMember & { user: User })[];
  roomId: string;
  onSubmit: (data: Partial<HardwareBomItem>) => void;
  editingItem?: HardwareBomItem | null;
}

function BomDialog({ open, onOpenChange, members, roomId, onSubmit, editingItem }: BomDialogProps) {
  const [formData, setFormData] = React.useState({
    component: '',
    quantity: 1,
    unit_est_cost: '',
    unit_actual_cost: '',
    buyer_id: '',
    status: 'planned' as BomStatus,
    supplier_url: '',
    notes: '',
  });

  React.useEffect(() => {
    if (editingItem) {
      setFormData({
        component: editingItem.component,
        quantity: editingItem.quantity,
        unit_est_cost: editingItem.unit_est_cost?.toString() || '',
        unit_actual_cost: editingItem.unit_actual_cost?.toString() || '',
        buyer_id: editingItem.buyer_id || '',
        status: editingItem.status,
        supplier_url: editingItem.supplier_url || '',
        notes: editingItem.notes || '',
      });
    } else {
      setFormData({
        component: '',
        quantity: 1,
        unit_est_cost: '',
        unit_actual_cost: '',
        buyer_id: '',
        status: 'planned' as BomStatus,
        supplier_url: '',
        notes: '',
      });
    }
  }, [editingItem, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, room_id: roomId, buyer_id: formData.buyer_id || null, quantity: Number(formData.quantity) || 0, unit_est_cost: formData.unit_est_cost ? Number(formData.unit_est_cost) : null, unit_actual_cost: formData.unit_actual_cost ? Number(formData.unit_actual_cost) : null });
    onOpenChange(false);
  };

  const BOM_STATUS_OPTIONS: { value: BomStatus; label: string }[] = [
    { value: 'planned', label: 'Planned' },
    { value: 'ordered', label: 'Ordered' },
    { value: 'received', label: 'Received' },
    { value: 'installed', label: 'Installed' },
    { value: 'failed', label: 'Failed' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit BOM Item' : 'Add BOM Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="component">Component *</Label>
            <Input
              id="component"
              value={formData.component}
              onChange={(e) => setFormData({ ...formData, component: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                onValueChange={(v: string) => setFormData({ ...formData, status: v as BomStatus })}
                defaultValue={formData.status}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOM_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Est. Unit Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.unit_est_cost}
                onChange={(e) => setFormData({ ...formData, unit_est_cost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Actual Unit Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.unit_actual_cost}
                onChange={(e) => setFormData({ ...formData, unit_actual_cost: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Buyer</Label>
            <Select
              onValueChange={(v: string) => setFormData({ ...formData, buyer_id: v })}
              defaultValue={formData.buyer_id}
            >
              <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.user.display_name || m.user.username || m.user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Supplier URL</Label>
            <Input
              value={formData.supplier_url}
              onChange={(e) => setFormData({ ...formData, supplier_url: e.target.value })}
              placeholder="https://supplier.com/item"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editingItem ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name || file.name);
    formData.append('type', type);
    formData.append('tags', tags);
    formData.append('is_final', isFinal.toString());
    formData.append('room_id', roomId);
    onSubmit(formData);
    onOpenChange(false);
  };

  const ARTIFACT_TYPES = [
    { value: 'apk', label: 'APK Build' },
    { value: 'lottie', label: 'Lottie Animation' },
    { value: 'riv', label: 'Rive Animation' },
    { value: 'presentation', label: 'Presentation' },
    { value: 'video', label: 'Video' },
    { value: 'image', label: 'Image' },
    { value: 'other', label: 'Other' },
  ];

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
                {ARTIFACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Leo, Mia, character, v1" />
          </div>

          <label className="flex items-center gap-2">
            <Switch checked={isFinal} onCheckedChange={setIsFinal} />
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

export function RoomDashboardClient({ room, initialTasks, initialBom, initialArtifacts, initialMembers }: {
  room: Room;
  initialTasks: (Task & { assignee?: User | null })[];
  initialBom: HardwareBomItem[];
  initialArtifacts: Artifact[];
  initialMembers: (RoomMember & { user: User })[];
}) {
  const { user } = useAuthStore();
  const { currentRoom, setCurrentRoom } = useRoomStore();
  const { tasks, setTasks, addTask, updateTask, removeTask } = useTaskStore();
  const { heartbeats, fileLocks } = useVibeStore();
  const [activeTab, setActiveTab] = React.useState<'tasks' | 'bom' | 'artifacts'>('tasks');
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [bomDialogOpen, setBomDialogOpen] = React.useState(false);
  const [artifactDialogOpen, setArtifactDialogOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [editingBomItem, setEditingBomItem] = React.useState<HardwareBomItem | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<TaskStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = React.useState<TaskCategory | 'all'>('all');

  React.useEffect(() => {
    setCurrentRoom(room);
    setTasks(initialTasks);
  }, [room, initialTasks, setCurrentRoom, setTasks]);

  const canManageRepo = Boolean(
    user &&
      (room.created_by === user.id ||
        initialMembers.some(
          (member) =>
            member.user_id === user.id && member.flag_is_team_leader
        ))
  );

  const filteredTasks = tasks.filter(task => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    return true;
  });

  const tasksByStatus = STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredTasks.filter(t => t.status === col.id);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    updateTask(id, updates);
    // TODO: Sync with Supabase
  };

  const handleDeleteTask = (id: string) => {
    removeTask(id);
    // TODO: Sync with Supabase
  };

  const handleCreateTask = (data: Partial<Task>) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      room_id: room.id,
      ...data,
      created_by: user?.id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      related_asset_ids: [],
    } as Task;
    addTask(newTask);
    // TODO: Sync with Supabase
  };

  const handleUpdateBom = (data: Partial<HardwareBomItem>) => {
    // TODO: Sync with Supabase
  };

  const handleUploadArtifact = (data: FormData) => {
    // TODO: Upload to Supabase Storage and create artifact record
  };

  const getHeartbeatForUser = (userId: string) => {
    for (const [key, hb] of heartbeats.entries()) {
      if (hb.user_id === userId && Date.now() - new Date(hb.last_heartbeat).getTime() < 5 * 60 * 1000) {
        return hb;
      }
    }
    return null;
  };

  const isFileLocked = (filePath: string) => {
    for (const [key, lock] of fileLocks.entries()) {
      if (lock.filePath === filePath && lock.expiresAt > Date.now()) {
        return lock;
      }
    }
    return null;
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Room Header */}
      <div className="border-b bg-white px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <Kanban className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{room.name}</h1>
              <p className="text-sm text-muted-foreground">
                {room.project_type} • {room.team_size} members • Invite: {room.invite_code}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Live Presence Avatars */}
            <div className="flex items-center gap-1">
              {initialMembers.slice(0, 5).map(member => {
                const hb = getHeartbeatForUser(member.user_id);
                const isActive = !!hb;
                return (
                  <Avatar
                    key={member.user_id}
                    className="relative"
                    src={member.user.avatar_url}
                    fallback={member.user.display_name || member.user.username || member.user.email}
                  >
                    {isActive && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                    )}
                  </Avatar>
                );
              })}
              {initialMembers.length > 5 && (
                <Avatar className="bg-muted" fallback={`+${initialMembers.length - 5}`} />
              )}
            </div>
            {!room.github_installation_id && canManageRepo && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/api/github/connect?roomId=${encodeURIComponent(room.id)}`}
                >
                  <Github className="w-4 h-4 mr-2" />
                  Connect GitHub
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/rooms/${room.id}/settings`}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="border-b bg-white px-6 flex-shrink-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tasks">
              <Kanban className="w-4 h-4 mr-2" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="bom">
              <Package className="w-4 h-4 mr-2" />
              BOM
            </TabsTrigger>
            <TabsTrigger value="artifacts">
              <FileImage className="w-4 h-4 mr-2" />
              Artifacts
            </TabsTrigger>
          </TabsList>
        </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* Tasks Kanban */}
        <TabsContent value="tasks" className="h-full">
          <div className="p-4 h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select onValueChange={setFilterStatus} defaultValue={filterStatus}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUS_COLUMNS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select onValueChange={setFilterCategory} defaultValue={filterCategory}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setTaskDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                New Task
              </Button>
              <TaskDialog
                open={taskDialogOpen}
                onOpenChange={setTaskDialogOpen}
                members={initialMembers}
                roomId={room.id}
                onSubmit={handleCreateTask}
              />
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto">
              <ScrollArea className="h-full">
                <div className="flex gap-4 h-full pb-4">
                  {STATUS_COLUMNS.map(col => (
                    <KanbanColumn
                      key={col.id}
                      status={col.id}
                      label={col.label}
                      tasks={tasksByStatus[col.id]}
                      members={initialMembers}
                      onUpdateTask={handleUpdateTask}
                      onDeleteTask={handleDeleteTask}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        {/* Hardware BOM */}
        <TabsContent value="bom" className="h-full">
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Bill of Materials</h2>
              <Button onClick={() => setBomDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
              <BomDialog
                open={bomDialogOpen}
                onOpenChange={setBomDialogOpen}
                members={initialMembers}
                roomId={room.id}
                onSubmit={handleUpdateBom}
              />
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Component</th>
                    <th className="pb-2 pr-4">Qty</th>
                    <th className="pb-2 pr-4">Est. Cost</th>
                    <th className="pb-2 pr-4">Actual Cost</th>
                    <th className="pb-2 pr-4">Buyer</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {initialBom.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No BOM items yet. Click "Add Item" to start tracking components.
                      </td>
                    </tr>
                  ) : (
                    initialBom.map(item => (
                      <tr key={item.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 pr-4 font-medium">{item.component}</td>
                        <td className="py-3 pr-4">{item.quantity}</td>
                        <td className="py-3 pr-4">{item.unit_est_cost ? `$${item.unit_est_cost}` : '—'}</td>
                        <td className="py-3 pr-4">{item.unit_actual_cost ? `$${item.unit_actual_cost}` : '—'}</td>
                        <td className="py-3 pr-4">
                          {item.buyer_id && initialMembers.find(m => m.user_id === item.buyer_id)?.user.display_name || '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="role" role={getBomStatusColor(item.status).replace('bg-', '').replace(' text-', '')}>
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded hover:bg-muted">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingBomItem(item)}>Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {initialBom.length > 0 && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{initialBom.reduce((sum, i) => sum + (i.total_est_cost || 0), 0).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Total Est. Cost</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{initialBom.reduce((sum, i) => sum + (i.total_actual_cost || 0), 0).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Total Actual Cost</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{initialBom.filter(i => i.status === 'received' || i.status === 'installed').length}</p>
                    <p className="text-sm text-muted-foreground">Received</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{initialBom.filter(i => i.status === 'failed').length}</p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Artifacts Gallery */}
        <TabsContent value="artifacts" className="h-full">
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Submission Hub / Artifacts</h2>
              <Button asChild className="gap-2">
                <Link href={`/dashboard/artifacts/upload?room=${room.id}`}>
                  <Plus className="w-4 h-4" />
                  Upload
                </Link>
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {initialArtifacts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <FileImage className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg">No artifacts yet</p>
                  <p className="text-sm">Upload APKs, Lottie animations, presentations, and more</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {initialArtifacts.map(artifact => (
                    <Card key={artifact.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="aspect-video bg-muted/50 flex items-center justify-center">
                          {artifact.type === 'image' && artifact.file_url && (
                            <img src={artifact.file_url} alt={artifact.name} className="max-h-full max-w-full object-contain" />
                          )}
                          {artifact.type !== 'image' && (
                            <div className="text-center p-4">
                              <FileImage className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                              <p className="font-medium">{artifact.name}</p>
                              <p className="text-xs text-muted-foreground">{artifact.type}</p>
                            </div>
                          )}
                        </div>
                        <div className="p-3 border-t">
                          <div className="flex items-center justify-between mb-2">
                            <span className="badge bg-secondary">{artifact.type}</span>
                            {artifact.is_final && <Badge variant="default">Final</Badge>}
                          </div>
                          <p className="text-sm font-medium truncate">{artifact.name}</p>
                          {artifact.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {artifact.tags.map(tag => (
                                <span key={tag} className="badge bg-secondary text-xs">{tag}</span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                            <span>{formatRelativeTime(artifact.created_at)}</span>
                            <span>{artifact.version || 'v1'}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </div>
      </Tabs>

      {/* Dialogs for editing (inline with triggers for new items) */}
      {editingTask && (
        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          members={initialMembers}
          roomId={room.id}
          onSubmit={(data) => handleUpdateTask(editingTask.id, data)}
          editingTask={editingTask}
        />
      )}
    </div>
  );
}