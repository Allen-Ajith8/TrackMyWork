'use client';

import * as React from 'react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import {
  Plus,
  Search,
  Filter,
  Kanban,
  List,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  Flag,
  ArrowRight,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toast, ToastProvider, ToastViewport, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { cn, formatRelativeTime, getTaskStatusColor, getRoleColor } from '@/lib/utils';
import { usePanicTasks } from '@/hooks/usePanicTasks';
import { useTaskStore } from '@/lib/store';
import type { Task, TaskStatus, TaskCategory, RoomMember, User, Room } from '@/types/database';

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

const PRIORITY_LABELS = { 0: 'Low', 1: 'Low', 2: 'Low', 3: 'Medium', 4: 'Medium', 5: 'Medium', 6: 'High', 7: 'High', 8: 'Critical', 9: 'Critical', 10: 'Critical' };

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
            <span className="badge bg-red-600 text-white font-bold tracking-wider text-[10px]">
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
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={cn('badge bg-secondary', CATEGORY_COLORS[task.category])}>{CATEGORY_LABELS[task.category]}</span>
        {task.priority > 5 && (
          <span className="badge bg-red-100 text-red-800">
            <Flag className="w-3 h-3 mr-1" />
            {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
          </span>
        )}
        {task.due_date && (
          <span className={cn('badge', new Date(task.due_date) < new Date() && task.status !== 'done' ? 'bg-red-100 text-red-800' : 'bg-secondary')}>
            <Calendar className="w-3 h-3 mr-1" />
            {formatRelativeTime(task.due_date)}
          </span>
        )}
      </div>
      {assignee && (
        <div className="flex items-center gap-1">
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
    <div className="flex-shrink-0 w-72 max-h-[calc(100vh-280px)] flex flex-col">
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
    is_blocker: false,
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
        is_blocker: Boolean(editingTask.is_blocker),
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
        is_blocker: false,
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
              <Label>Priority (0-10)</Label>
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

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_blocker"
              checked={formData.is_blocker}
              onChange={(e) => setFormData({ ...formData, is_blocker: e.target.checked })}
              className="rounded border-surface-300 text-red-600 focus:ring-red-500 h-4 w-4"
            />
            <Label htmlFor="is_blocker" className="text-sm font-medium text-red-700 cursor-pointer">
              Flag as Blocker (shows prominently & prioritizes in Panic Mode)
            </Label>
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

export function RoomTasksClient({ room, initialTasks, initialMembers }: {
  room: Room;
  initialTasks: (Task & { assignee?: User | null })[];
  initialMembers: (RoomMember & { user: User })[];
}) {
  const { user } = useAuthStore();
  const [supabase] = React.useState(() => createClient());
  const [tasks, setTasks] = React.useState(initialTasks);
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<TaskStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = React.useState<TaskCategory | 'all'>('all');
  const [viewMode, setViewMode] = React.useState<'kanban' | 'list'>('kanban');
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  const { isPanicMode, panicTasks, blockerCount, urgentCount } = usePanicTasks({
    tasks,
    roomId: room.id,
  });

  // Sync tasks with global task store for header countdown and badges
  const setStoreTasks = useTaskStore((state) => state.setTasks);
  React.useEffect(() => {
    setStoreTasks(tasks);
  }, [tasks, setStoreTasks]);

  // Realtime subscription for room tasks
  React.useEffect(() => {
    const channel = supabase
      .channel(`room-tasks-${room.id}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Task;
            setTasks((prev) => [inserted, ...prev.filter((t) => t.id !== inserted.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Task;
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setTasks((prev) => prev.filter((t) => t.id !== old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, supabase]);

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

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));
    try {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Failed to update task:', error);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await supabase.from('tasks').delete().eq('id', id);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleCreateTask = async (data: Partial<Task>) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      room_id: room.id,
      ...data,
      created_by: user?.id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      related_asset_ids: [],
    } as Task;
    setTasks(prev => [newTask, ...prev]);
    try {
      const { error } = await supabase.from('tasks').insert(newTask);
      if (error) throw error;
    } catch (error) {
      console.error('Failed to create task:', error);
      setTasks(prev => prev.filter(t => t.id !== newTask.id));
    }
  };

  return (
    <ToastProvider>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Header */}
        <div className="border-b bg-white px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Tasks</h1>
              <p className="text-sm text-muted-foreground">{room.name} • {tasks.length} tasks</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'kanban' ? 'list' : 'kanban')}>
                {viewMode === 'kanban' ? <List className="w-4 h-4" /> : <Kanban className="w-4 h-4" />}
              </Button>
              <Button onClick={() => setTaskDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                New Task
              </Button>
              <TaskDialog
                open={taskDialogOpen}
                onOpenChange={setTaskDialogOpen}
                members={initialMembers}
                roomId={room.id}
                onSubmit={editingTask ? (data) => handleUpdateTask(editingTask.id, data) : handleCreateTask}
                editingTask={editingTask}
              />
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-b bg-white px-6 py-3 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-4">
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
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isPanicMode && filteredTasks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-surface-50/50">
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
          ) : viewMode === 'kanban' ? (
            <ScrollArea className="h-full p-4">
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
          ) : (
            <div className="h-full p-4 overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Task</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Category</th>
                      <th className="pb-2 pr-4">Assignee</th>
                      <th className="pb-2 pr-4">Priority</th>
                      <th className="pb-2 pr-4">Due Date</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          No tasks found. Create a new task to get started.
                        </td>
                      </tr>
                    ) : (
                      filteredTasks.map(task => {
                        const assignee = task.assigned_to ? initialMembers.find(m => m.user_id === task.assigned_to) : null;
                        return (
                          <tr key={task.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 pr-4">
                              <p className="font-medium">{task.title}</p>
                              {task.description && <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>}
                            </td>
                            <td className="py-3 pr-4"><Badge variant="role" role={getTaskStatusColor(task.status).replace('bg-', '').replace(' text-', '')}>{task.status.replace('_', ' ')}</Badge></td>
                            <td className="py-3 pr-4"><Badge variant="role" role={CATEGORY_COLORS[task.category].replace('bg-', '').replace(' text-', '')}>{CATEGORY_LABELS[task.category]}</Badge></td>
                            <td className="py-3 pr-4">{assignee ? <Avatar className="h-5 w-5 inline" src={assignee.user.avatar_url} fallback={assignee.user.display_name || assignee.user.username || undefined} /> : <span className="text-muted-foreground">—</span>}</td>
                            <td className="py-3 pr-4">{task.priority > 5 ? <span className="badge bg-red-100 text-red-800">{PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}</span> : task.priority}</td>
                            <td className="py-3 pr-4">{task.due_date ? formatRelativeTime(task.due_date) : '—'}</td>
                            <td className="py-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-1 rounded hover:bg-muted"><MoreVertical className="w-4 h-4" /></button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditingTask(task)}>Edit</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-red-600">Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
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