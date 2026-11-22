'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Award,
  FileText,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Shield,
  Info,
  Mail,
  Send,
  Key,
  Loader2,
  MessageSquare,
  Megaphone,
  Calendar,
  Flame,
  Gavel,
} from 'lucide-react';
import { RoomTeamChat } from '@/components/room-team-chat';
import { CourtroomPanel } from '@/components/courtroom-panel';
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
import { usePanicTasks } from '@/hooks/usePanicTasks';
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
    <div className={cn(
      "bg-white rounded-lg border shadow-sm p-3 hover:shadow-md transition-shadow",
      (task.is_blocker || task.status === 'blocked') && "border-red-300 ring-1 ring-red-300/50"
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('badge', getTaskStatusColor(task.status))}>{task.status.replace('_', ' ')}</span>
          {(task.is_blocker || task.status === 'blocked') && (
            <span className="badge bg-red-600 text-white font-bold text-[10px]">
              BLOCKER
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-muted">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onUpdate(task.id, { is_blocker: !task.is_blocker })}>
              {task.is_blocker ? 'Unflag Blocker' : 'Flag as Blocker'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
  const [type, setType] = React.useState<'apk' | 'lottie' | 'riv' | 'presentation' | 'video' | 'image' | 'document' | 'other'>('document');
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
    { value: 'document', label: 'Document / Spec / Rules' },
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

const DASHBOARD_ROLE_OPTIONS = [
  { value: 'Frontend', label: 'Frontend', defaultPermissions: { can_edit_repo: true, can_trigger_nim: false, can_assign_tasks: true, can_upload_assets: true, can_manage_bom: false, can_invite_members: false, can_edit_rules: false } },
  { value: 'Backend', label: 'Backend', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true, can_assign_tasks: true, can_upload_assets: true, can_manage_bom: false, can_invite_members: false, can_edit_rules: false } },
  { value: 'AI/ML', label: 'AI/ML', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true, can_assign_tasks: false, can_upload_assets: true, can_manage_bom: false, can_invite_members: false, can_edit_rules: false } },
  { value: 'Team Leader', label: 'Team Leader (Co-lead)', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true, can_assign_tasks: true, can_upload_assets: true, can_manage_bom: true, can_invite_members: true, can_edit_rules: true } },
  { value: 'Pitch/Media', label: 'Pitch/Media', defaultPermissions: { can_edit_repo: false, can_trigger_nim: false, can_assign_tasks: true, can_upload_assets: true, can_manage_bom: false, can_invite_members: true, can_edit_rules: false } },
  { value: 'Video Editor', label: 'Video Editor', defaultPermissions: { can_edit_repo: false, can_trigger_nim: false, can_assign_tasks: false, can_upload_assets: true, can_manage_bom: false, can_invite_members: false, can_edit_rules: false } },
  { value: 'Hardware', label: 'Hardware', defaultPermissions: { can_edit_repo: true, can_trigger_nim: false, can_assign_tasks: true, can_upload_assets: true, can_manage_bom: true, can_invite_members: false, can_edit_rules: false } },
  { value: 'Designer', label: 'Designer', defaultPermissions: { can_edit_repo: false, can_trigger_nim: false, can_assign_tasks: false, can_upload_assets: true, can_manage_bom: false, can_invite_members: false, can_edit_rules: false } },
  { value: 'DevOps', label: 'DevOps', defaultPermissions: { can_edit_repo: true, can_trigger_nim: true, can_assign_tasks: true, can_upload_assets: false, can_manage_bom: false, can_invite_members: false, can_edit_rules: true } },
  { value: 'Custom', label: 'Custom Role', defaultPermissions: { can_edit_repo: true, can_trigger_nim: false, can_assign_tasks: true, can_upload_assets: true, can_manage_bom: false, can_invite_members: false, can_edit_rules: false } },
];

const RBAC_TOGGLES: { key: string; label: string; desc: string }[] = [
  { key: 'can_edit_repo', label: 'Edit Repository', desc: 'Push code, create branches, open/merge PRs' },
  { key: 'can_trigger_nim', label: 'Trigger NIM AI', desc: 'Run automated AI summaries & SOS debug routines' },
  { key: 'can_assign_tasks', label: 'Assign Tasks', desc: 'Create, update and reassign Kanban tasks' },
  { key: 'can_upload_assets', label: 'Upload Assets', desc: 'Upload demo videos, APK builds, and slides' },
  { key: 'can_manage_bom', label: 'Manage BOM', desc: 'Add and edit hardware components & budget' },
  { key: 'can_invite_members', label: 'Invite Teammates', desc: 'Send room invitations to other teammates' },
  { key: 'can_edit_rules', label: 'Edit Room Rules', desc: 'Modify tech stack locks, rubric and deadlines' },
];

interface InviteTeammateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomName: string;
  inviteCode: string;
  onInviteSent?: (newMember: any) => void;
}

function InviteTeammateDialog({
  open,
  onOpenChange,
  roomId,
  roomName,
  inviteCode,
  onInviteSent,
}: InviteTeammateDialogProps) {
  const [email, setEmail] = React.useState('');
  const [roleTitle, setRoleTitle] = React.useState('Frontend');
  const [customRoleName, setCustomRoleName] = React.useState('');
  const [permissions, setPermissions] = React.useState<Record<string, boolean>>({
    can_edit_repo: true,
    can_trigger_nim: false,
    can_assign_tasks: true,
    can_upload_assets: true,
    can_manage_bom: false,
    can_invite_members: false,
    can_edit_rules: false,
  });
  const [loading, setLoading] = React.useState(false);
  const [successData, setSuccessData] = React.useState<{
    joinUrl: string;
    inviteCode: string;
    email: string;
    emailSent: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSuccessData(null);
      setErrorMsg('');
      setEmail('');
    }
  }, [open]);

  const handleRoleSelect = (selectedRole: string) => {
    setRoleTitle(selectedRole);
    const preset = DASHBOARD_ROLE_OPTIONS.find((r) => r.value === selectedRole);
    if (preset) {
      setPermissions((prev) => ({ ...prev, ...preset.defaultPermissions }));
    }
  };

  const handleTogglePermission = (key: string, checked: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/rooms/${roomId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          role_title: roleTitle,
          custom_role_name: roleTitle === 'Custom' ? customRoleName.trim() : null,
          permissions,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invitation.');
      }

      const generatedUrl = data.joinUrl || `${window.location.origin}/dashboard/rooms/join?roomId=${encodeURIComponent(roomId)}&code=${encodeURIComponent(data.inviteCode || inviteCode)}`;

      setSuccessData({
        joinUrl: generatedUrl,
        inviteCode: data.inviteCode || inviteCode,
        email: email.trim(),
        emailSent: Boolean(data.emailSent),
      });

      if (onInviteSent && data.member) {
        onInviteSent({
          ...data.member,
          user: data.user || {
            email: email.trim(),
            display_name: email.split('@')[0],
          },
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not send invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (successData?.joinUrl) {
      navigator.clipboard.writeText(successData.joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyCode = () => {
    const codeToCopy = successData?.inviteCode || inviteCode;
    if (codeToCopy) {
      navigator.clipboard.writeText(codeToCopy);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Mail className="w-5 h-5 text-primary-600" />
              Invite Teammate via Email
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
              Room: {inviteCode}
            </Badge>
          </div>
        </DialogHeader>

        {successData ? (
          <div className="space-y-4 py-2">
            {successData.emailSent ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="font-bold text-sm">Invitation Email Dispatched!</p>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  An email has been delivered directly to <strong className="font-semibold">{successData.email}</strong>. When they click the link in their email, they will automatically join <strong className="font-semibold">{roomName}</strong>.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="font-bold text-sm">Teammate Added to Room!</p>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  The invitation is created for <strong className="font-semibold">{successData.email}</strong>. Because SMTP credentials are not yet added in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env.local</code>, automated email delivery is paused.
                </p>
                <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  👉 <strong>To send real emails to inboxes automatically</strong>: Add your Gmail App Password (<code className="font-mono">GMAIL_USER</code> &amp; <code className="font-mono">GMAIL_APP_PASSWORD</code>) to <code className="font-mono">.env.local</code>.
                </div>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Direct One-Click Join Link (Share with Teammate)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={successData.joinUrl}
                    className="font-mono text-xs bg-muted/50 truncate"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="shrink-0 text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Copied!' : 'Copy Link'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  6-Digit Room Invite Code
                </Label>
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface-100 border font-mono">
                  <span className="text-base font-bold tracking-widest text-primary-900">{successData.inviteCode}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyCode}
                    className="h-7 text-xs font-semibold gap-1 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Copied' : 'Copy Code'}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSuccessData(null);
                  setEmail('');
                }}
              >
                Invite Another Teammate
              </Button>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-primary-600 hover:bg-primary-700 text-white font-semibold"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="teammateEmail" className="text-xs font-bold">
                Teammate Email Address *
              </Label>
              <Input
                id="teammateEmail"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                An invitation email will be dispatched containing the direct room join link and code.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Role Title</Label>
                <Select value={roleTitle} onValueChange={handleRoleSelect}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DASHBOARD_ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {roleTitle === 'Custom' && (
                <div className="space-y-1.5">
                  <Label htmlFor="customRole" className="text-xs font-bold">Custom Title</Label>
                  <Input
                    id="customRole"
                    placeholder="e.g. Lead Researcher"
                    value={customRoleName}
                    onChange={(e) => setCustomRoleName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              )}
            </div>

            {/* RBAC Permission Switches */}
            <div className="space-y-2 border rounded-xl p-3 bg-muted/20">
              <div className="flex items-center justify-between pb-1 border-b">
                <span className="text-xs font-bold text-foreground">Role Permissions (RBAC)</span>
                <span className="text-[10px] text-muted-foreground font-mono">Discord-style</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto pr-1">
                {RBAC_TOGGLES.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <Switch
                      checked={Boolean(permissions[perm.key])}
                      onCheckedChange={(val) => handleTogglePermission(perm.key, val)}
                      className="mt-0.5 scale-90"
                    />
                    <div className="leading-tight">
                      <p className="font-semibold text-foreground text-[11px]">{perm.label}</p>
                      <p className="text-[10px] text-muted-foreground">{perm.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !email.trim()}
                className="bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow-xs"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending Email...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ConnectGithubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomName: string;
  currentRepo: string | null;
  onConnected: (repoUrl: string) => void;
}

function ConnectGithubDialog({
  open,
  onOpenChange,
  roomId,
  roomName,
  currentRepo,
  onConnected,
}: ConnectGithubDialogProps) {
  const [repoInput, setRepoInput] = React.useState(currentRepo || '');
  const [loading, setLoading] = React.useState(false);
  const [verifiedRepo, setVerifiedRepo] = React.useState<any>(null);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setRepoInput(currentRepo || '');
      setErrorMsg('');
      setSuccessMsg('');
      setVerifiedRepo(null);
    }
  }, [open, currentRepo]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/github/verify-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: repoInput.trim(),
          roomId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Could not verify GitHub repository.');
      }

      setVerifiedRepo(data.repo);
      setSuccessMsg(`🎉 Connected ${data.repo.fullName} to ${roomName}!`);
      onConnected(data.repo.htmlUrl);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect repository.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Github className="w-5 h-5 text-foreground" />
              Connect GitHub Repository
            </DialogTitle>
            <Badge variant="outline" className="text-xs font-mono">
              Live GitHub Sync
            </Badge>
          </div>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-4 pt-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="repoInput" className="text-xs font-bold">
              GitHub Repository URL or owner/repo *
            </Label>
            <Input
              id="repoInput"
              placeholder="e.g. https://github.com/owner/repo or owner/repo"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              className="font-mono text-xs"
              required
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Enter any public or team repository URL to link commits, branches, and PRs to this room.
            </p>
          </div>

          {verifiedRepo && (
            <div className="p-3 rounded-xl bg-surface-100 border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <a
                  href={verifiedRepo.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-primary-700 hover:underline flex items-center gap-1"
                >
                  <Github className="w-3.5 h-3.5" />
                  {verifiedRepo.fullName}
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  🌿 {verifiedRepo.defaultBranch}
                </Badge>
              </div>
              {verifiedRepo.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {verifiedRepo.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t">
                <span>⭐ {verifiedRepo.stars} stars</span>
                <span>🍴 {verifiedRepo.forks} forks</span>
                <span>💻 {verifiedRepo.language}</span>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {verifiedRepo ? 'Close' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={loading || !repoInput.trim()}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Github className="w-4 h-4 mr-2" />
                  {verifiedRepo ? 'Re-verify' : 'Connect Repository'}
                </>
              )}
            </Button>
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
  const router = useRouter();
  const { currentRoom, setCurrentRoom, setRoomMembers } = useRoomStore();
  const { tasks, setTasks, addTask, updateTask, removeTask } = useTaskStore();
  const { heartbeats, fileLocks } = useVibeStore();
  const [activeTab, setActiveTab] = React.useState<
    'tasks' | 'chat' | 'courtroom' | 'bom' | 'artifacts' | 'rules'
  >('tasks');
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [bomDialogOpen, setBomDialogOpen] = React.useState(false);
  const [artifactDialogOpen, setArtifactDialogOpen] = React.useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = React.useState(false);
  const [membersList, setMembersList] = React.useState(initialMembers);
  const [connectedRepo, setConnectedRepo] = React.useState<string | null>(room.github_repo || null);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [editingBomItem, setEditingBomItem] = React.useState<HardwareBomItem | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<TaskStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = React.useState<TaskCategory | 'all'>('all');

  React.useEffect(() => {
    if (!room?.id) return;
    const current = useRoomStore.getState().currentRoom;
    const targetRepo = connectedRepo ?? room.github_repo ?? null;
    if (current?.id !== room.id || (current?.github_repo || null) !== targetRepo) {
      setCurrentRoom({ ...room, github_repo: targetRepo });
    }
    setRoomMembers(initialMembers);
    setTasks(initialTasks);
  }, [room.id, connectedRepo, room.github_repo]);

  // Check URL parameters for direct github connect trigger
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('connectGithub') === 'true') {
        setGithubDialogOpen(true);
      }
    }
  }, []);

  const activeRoom = (currentRoom && (currentRoom.id === room.id || currentRoom.name === room.name))
    ? { ...room, ...currentRoom, github_repo: connectedRepo ?? currentRoom.github_repo ?? room.github_repo }
    : { ...room, github_repo: connectedRepo ?? room.github_repo };

  const canManageRepo = Boolean(
    user &&
      (room.created_by === user.id ||
        membersList.some(
          (member) =>
            member.user_id === user.id && member.flag_is_team_leader
        ))
  );

  const canInvite = Boolean(
    user &&
      ((user as any).is_global_admin ||
        room.created_by === user.id ||
        membersList.some(
          (member) =>
            member.user_id === user.id && (member.flag_is_team_leader || member.flag_can_invite_members)
        ))
  );

  const deadlineTimestamp =
    (activeRoom as any).submission_deadline ||
    (activeRoom as any).deadline ||
    (activeRoom as any).hackathon_end_time ||
    (activeRoom as any).hackathon_end_date ||
    new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const hackathonName = (activeRoom as any).hackathon_name;

  // Real-time Hack-Timer countdown calculation (updates every second)
  const [timeLeft, setTimeLeft] = React.useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
    urgency: 'critical' | 'warning' | 'normal' | 'expired';
  } | null>(null);

  React.useEffect(() => {
    if (!deadlineTimestamp) return;

    const calcTime = () => {
      const now = Date.now();
      const target = new Date(deadlineTimestamp).getTime();
      const diff = target - now;

      if (isNaN(target)) return null;

      if (diff <= 0) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          formatted: 'Deadline Expired',
          urgency: 'expired' as const,
        };
      }

      const totalSecs = Math.floor(diff / 1000);
      const days = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      let urgency: 'critical' | 'warning' | 'normal' = 'normal';
      if (diff < 24 * 3600 * 1000) {
        urgency = 'critical';
      } else if (diff < 72 * 3600 * 1000) {
        urgency = 'warning';
      }

      return {
        days,
        hours,
        minutes,
        seconds,
        formatted: `${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds}s`,
        urgency,
      };
    };

    setTimeLeft(calcTime());
    const interval = setInterval(() => {
      setTimeLeft(calcTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [deadlineTimestamp]);

  const { isPanicMode, panicTasks } = usePanicTasks({
    tasks,
    roomId: room.id,
  });

  const baseTasks = isPanicMode ? panicTasks : tasks;

  const filteredTasks = baseTasks.filter(task => {
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

  const handleUploadArtifact = async (data: FormData) => {
    try {
      const response = await fetch('/api/artifacts', {
        method: 'POST',
        body: data,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Could not upload artifact.');
      }
      router.refresh();
    } catch (error) {
      console.error('Failed to upload artifact:', error);
      if (typeof window !== 'undefined') {
        window.alert(
          error instanceof Error ? error.message : 'Could not upload artifact.'
        );
      }
    }
  };

  const getHeartbeatForUser = (userId: string) => {
    for (const heartbeat of heartbeats.values()) {
      if (
        heartbeat.room_id === room.id &&
        heartbeat.user_id === userId &&
        Date.now() - new Date(heartbeat.last_heartbeat).getTime() < 5 * 60 * 1000
      ) {
        return heartbeat;
      }
    }
    return null;
  };

  const isFileLocked = (filePath: string) => {
    for (const lock of fileLocks.values()) {
      if (
        lock.roomId === room.id &&
        lock.filePath === filePath &&
        lock.expiresAt > Date.now()
      ) {
        return lock;
      }
    }
    return null;
  };

  const liveHeartbeats = Array.from(heartbeats.values()).filter(
    (heartbeat) =>
      heartbeat.room_id === room.id &&
      Date.now() - new Date(heartbeat.last_heartbeat).getTime() < 5 * 60 * 1000
  );

  const liveLocks = Array.from(fileLocks.values()).filter(
    (lock) => lock.roomId === room.id && lock.expiresAt > Date.now()
  );

  const memberLabel = (userId: string) => {
    const member = initialMembers.find((entry) => entry.user_id === userId);
    return (
      member?.user.display_name ||
      member?.user.username ||
      member?.user.email ||
      'Teammate'
    );
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
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold">{activeRoom.name}</h1>
                {timeLeft && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold shadow-xs ${
                      timeLeft.urgency === 'critical'
                        ? 'bg-red-100 text-red-900 border border-red-300 animate-pulse'
                        : timeLeft.urgency === 'warning'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-purple-100 text-purple-900 border border-purple-300'
                    }`}
                    title={`Hack-Timer Countdown: ${timeLeft.formatted} remaining`}
                  >
                    <Clock className="w-3 h-3 text-primary-600" />
                    <span>Hack-Timer: {timeLeft.formatted}</span>
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {hackathonName ? `${hackathonName} • ` : ''}
                {activeRoom.project_type} • {activeRoom.team_size} members • Invite: {activeRoom.invite_code}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* GitHub Connection Status / Trigger */}
            {connectedRepo ? (
              <div className="flex items-center gap-1">
                <a
                  href={connectedRepo.startsWith('http') ? connectedRepo : `https://github.com/${connectedRepo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-surface-50 hover:bg-surface-100 text-xs font-semibold text-foreground transition-colors"
                  title="Open connected GitHub repository"
                >
                  <Github className="w-3.5 h-3.5 text-primary-600" />
                  <span className="max-w-[130px] truncate">{connectedRepo.replace('https://github.com/', '')}</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGithubDialogOpen(true)}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Connect a different repository"
                >
                  Change
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGithubDialogOpen(true)}
                className="gap-1.5 text-xs font-semibold border-primary-200 text-primary-700 bg-primary-50/50 hover:bg-primary-100"
              >
                <Github className="w-4 h-4 text-primary-600" />
                <span>Connect GitHub</span>
              </Button>
            )}

            {canInvite && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setInviteDialogOpen(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white font-medium shadow-xs"
              >
                <Mail className="w-4 h-4 mr-2" />
                Invite Teammate
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/rooms/${room.id}/team`}>
                <Users className="w-4 h-4 mr-2" />
                Team
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/rooms/${room.id}/settings`}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Prominent Deadline Notification Banner */}
      {timeLeft && (
        <div
          className={`px-6 py-2 flex items-center justify-between text-xs font-medium border-b shadow-xs transition-colors ${
            timeLeft.urgency === 'critical'
              ? 'bg-red-600 text-white animate-pulse'
              : timeLeft.urgency === 'warning'
              ? 'bg-amber-100 text-amber-950 border-amber-300'
              : 'bg-purple-50 text-purple-950 border-purple-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {timeLeft.urgency === 'critical' ? (
              <Flame className="w-4 h-4 text-amber-300" />
            ) : (
              <Clock className="w-4 h-4 text-primary-600" />
            )}
            <span>
              <strong>{timeLeft.urgency === 'critical' ? '🚨 FINAL SPRINT ALERT:' : '⏰ DEADLINE NOTICE:'}</strong>{' '}
              {timeLeft.formatted} remaining until final project submission (
              {new Date(deadlineTimestamp).toLocaleDateString()} {new Date(deadlineTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={timeLeft.urgency === 'critical' ? 'secondary' : 'outline'}
              onClick={() => setActiveTab('chat')}
              className="h-6 text-[11px] font-bold gap-1"
            >
              <Megaphone className="w-3 h-3" />
              Announce in Chat
            </Button>
          </div>
        </div>
      )}

      {/* Live IDE telemetry (heartbeats + file locks from the MCP server) */}
      {(liveHeartbeats.length > 0 || liveLocks.length > 0) && (
        <div className="border-b bg-white px-6 py-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-green-700">
            <HeartPulse className="w-3.5 h-3.5" />
            Coding now
          </span>
          {liveHeartbeats.map((heartbeat) => (
            <Badge
              key={`${heartbeat.user_id}-${heartbeat.editor_type}`}
              variant="secondary"
              className="font-normal"
            >
              {memberLabel(heartbeat.user_id)}
              {heartbeat.file_path ? ` · ${heartbeat.file_path}` : ''}
              {heartbeat.editor_type ? ` · ${heartbeat.editor_type}` : ''}
            </Badge>
          ))}
          {liveLocks.map((lock) => (
            <Badge
              key={lock.id}
              variant="outline"
              className="font-normal border-amber-300 bg-amber-50 text-amber-800"
              title={`Locked until ${new Date(lock.expiresAt).toLocaleTimeString()}`}
            >
              <AlertCircle className="w-3 h-3 mr-1" />
              {lock.filePath}
              {lock.userName ? ` · ${lock.userName}` : ''}
            </Badge>
          ))}
        </div>
      )}

      {/* Tab Navigation - BOM is only displayed for hardware projects */}
      {(() => {
        const isHardware = activeRoom.project_type === 'hardware';
        return (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <div className="border-b bg-white px-6 flex-shrink-0">
              <TabsList className={cn('grid w-full', isHardware ? 'grid-cols-6' : 'grid-cols-5')}>
                <TabsTrigger value="tasks">
                  <Kanban className="w-4 h-4 mr-2" />
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="chat">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Team Chat
                </TabsTrigger>
                <TabsTrigger value="courtroom">
                  <Gavel className="w-4 h-4 mr-2" />
                  Courtroom
                </TabsTrigger>
                {isHardware && (
                  <TabsTrigger value="bom">
                    <Package className="w-4 h-4 mr-2" />
                    BOM
                  </TabsTrigger>
                )}
                <TabsTrigger value="artifacts">
                  <FileImage className="w-4 h-4 mr-2" />
                  Artifacts
                </TabsTrigger>
                <TabsTrigger value="rules">
                  <Award className="w-4 h-4 mr-2" />
                  Rules & Rubric
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
              {isPanicMode && filteredTasks.length === 0 ? (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center bg-surface-50/50 rounded-xl border">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-surface-900 mb-1">
                    No blockers, nothing due in the next 2h
                  </h3>
                  <p className="text-sm text-surface-500 max-w-sm">
                    All critical work is resolved or not urgently due. Take a breath, you are on track!
                  </p>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </TabsContent>

        {/* Hardware BOM (Only for Hardware Projects) */}
        {isHardware && (
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
        )}

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
                            <div className="flex items-center gap-1">
                              {(artifact.extracted_text || artifact.content) && (
                                <Badge variant="outline" className="text-[9px] border-indigo-300 text-indigo-800">
                                  AI Ready
                                </Badge>
                              )}
                              {artifact.is_final && <Badge variant="default">Final</Badge>}
                            </div>
                          </div>
                          <Link
                            href={`/dashboard/rooms/${room.id}/artifacts/${artifact.id}`}
                            className="text-sm font-medium truncate hover:text-primary-700 hover:underline block"
                          >
                            {artifact.name}
                          </Link>
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

        {/* Team Live Chat */}
        <TabsContent value="chat" className="h-full">
          <div className="p-4 h-full">
            <RoomTeamChat
              roomId={activeRoom.id}
              roomName={activeRoom.name}
              inviteCode={activeRoom.invite_code}
              githubRepo={connectedRepo ?? activeRoom.github_repo ?? null}
              deadline={deadlineTimestamp}
              currentUser={user}
              isTeamLeader={canInvite}
              userRole={membersList.find((m) => m.user_id === user?.id)?.role_title || (canInvite ? 'Team Leader' : 'Frontend')}
            />
          </div>
        </TabsContent>

        {/* AI Courtroom */}
        <TabsContent value="courtroom" className="h-full">
          <CourtroomPanel
            roomId={activeRoom.id}
            roomName={activeRoom.name}
            initialArtifacts={initialArtifacts}
          />
        </TabsContent>

        {/* Rules & Rubric */}
        <TabsContent value="rules" className="h-full overflow-y-auto p-6 space-y-4">
          <div className="max-w-4xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary-600" />
                  Hackathon Rules, Rubric & Constraints
                </h2>
                <p className="text-xs text-muted-foreground">
                  Official project specifications, evaluation criteria, and tech stack locks.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Problem Statement
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs leading-relaxed text-surface-800">
                  {activeRoom.problem_statement || activeRoom.description || 'No problem statement recorded.'}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Submission Format & Budget Cap
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-foreground">Format: </span>
                    <span className="text-muted-foreground">{activeRoom.submission_format || 'GitHub Repo + Pitch Video + Presentation'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Allowed Tech: </span>
                    <span className="text-muted-foreground">{activeRoom.allowed_tech || 'Open / Unrestricted'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {activeRoom.judging_rubric && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Judging Rubric
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 font-mono text-xs whitespace-pre-wrap leading-relaxed text-surface-800 max-h-60 overflow-y-auto">
                    {activeRoom.judging_rubric}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeRoom.rules_text && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Official Competition Rules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 font-mono text-xs whitespace-pre-wrap leading-relaxed text-surface-800 max-h-60 overflow-y-auto">
                    {activeRoom.rules_text}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </div>
      </Tabs>
      );
      })()}

      {/* Dialogs for editing (inline with triggers for new items) */}
      {editingTask && (
        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          members={membersList}
          roomId={room.id}
          onSubmit={(data) => handleUpdateTask(editingTask.id, data)}
          editingTask={editingTask}
        />
      )}

      {/* Invite Teammate via Email Dialog */}
      <InviteTeammateDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        roomId={activeRoom.id}
        roomName={activeRoom.name}
        inviteCode={activeRoom.invite_code}
        onInviteSent={(newMember) => {
          setMembersList((prev) => [...prev, newMember]);
        }}
      />

      {/* Connect GitHub Dialog */}
      <ConnectGithubDialog
        open={githubDialogOpen}
        onOpenChange={setGithubDialogOpen}
        roomId={activeRoom.id}
        roomName={activeRoom.name}
        currentRepo={connectedRepo}
        onConnected={(repoUrl) => {
          setConnectedRepo(repoUrl);
          setCurrentRoom({ ...activeRoom, github_repo: repoUrl });
        }}
      />
    </div>
  );
}