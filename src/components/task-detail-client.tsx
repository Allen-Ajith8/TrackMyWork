'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatDate, formatRelativeTime, getTaskStatusColor } from '@/lib/utils';
import type { Task, TaskCategory, TaskStatus } from '@/types/database';

interface MemberOption {
  userId: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];

const CATEGORIES: TaskCategory[] = ['code', 'hardware', 'animation', 'design', 'docs', 'pitch'];

export function TaskDetailClient({
  room,
  task,
  members,
}: {
  room: { id: string; name: string };
  task: Task;
  members: MemberOption[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [category, setCategory] = useState<TaskCategory>(task.category);
  const [priority, setPriority] = useState(String(task.priority));
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || '');
  const [dueDate, setDueDate] = useState(
    task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : ''
  );
  const [isBlocker, setIsBlocker] = useState(Boolean(task.is_blocker));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const assignee = members.find((member) => member.userId === assignedTo);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (title.trim().length < 3) {
      setError('Task title must be at least 3 characters.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        status,
        category,
        priority: Number(priority),
        assigned_to: assignedTo || null,
        due_date: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
        is_blocker: isBlocker,
        completed_at: status === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', task.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', task.id);
    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }
    router.push(`/dashboard/rooms/${room.id}/tasks`);
    router.refresh();
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <Link href={`/dashboard/rooms/${room.id}/tasks`} className="btn-ghost w-fit">
        <ArrowLeft className="w-4 h-4" />
        Back to {room.name} tasks
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('badge', getTaskStatusColor(status))}>{status.replace('_', ' ')}</span>
            <span className="badge bg-surface-100 text-surface-700 capitalize">{category}</span>
            <span className="text-xs text-surface-400">
              Created {formatRelativeTime(task.created_at)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-surface-900 mt-2">{title || 'Untitled task'}</h1>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="btn-outline text-red-600 hover:bg-red-50 w-fit"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Delete task
        </button>
      </div>

      <form onSubmit={handleSave} className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <div className="card p-6 space-y-5">
          <div>
            <label htmlFor="title" className="label">
              Title
            </label>
            <input
              id="title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={140}
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              className="input min-h-[180px]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add context, acceptance criteria or links…"
            />
          </div>

          <div>
            <label htmlFor="status" className="label">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium border capitalize transition-colors',
                    status === value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
                  )}
                >
                  {value.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="detailIsBlocker"
              checked={isBlocker}
              onChange={(e) => setIsBlocker(e.target.checked)}
              className="rounded border-surface-300 text-red-600 focus:ring-red-500 h-4 w-4"
            />
            <label htmlFor="detailIsBlocker" className="text-sm font-medium text-red-700 cursor-pointer">
              Flag as Blocker (prioritized in Panic Mode)
            </label>
          </div>

          {error && (
            <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-lg px-4 py-3 text-sm bg-green-50 text-green-700 border border-green-200">
              Task saved.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Link href={`/dashboard/rooms/${room.id}/tasks`} className="btn-ghost">
              Cancel
            </Link>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        <aside className="card p-5 space-y-4">
          <div>
            <label htmlFor="assignee" className="label">
              Assignee
            </label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <select
                id="assignee"
                className="input pl-9"
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name} · {member.role}
                  </option>
                ))}
              </select>
            </div>
            {assignee && (
              <div className="flex items-center gap-2 mt-3">
                <div className="w-7 h-7 rounded-full bg-primary-100 overflow-hidden flex items-center justify-center">
                  {assignee.avatarUrl ? (
                    <img
                      src={assignee.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-primary-700">
                      {assignee.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-900">{assignee.name}</p>
                  <p className="text-xs text-surface-500">{assignee.role}</p>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-surface-200" />

          <div>
            <label htmlFor="category" className="label">
              Category
            </label>
            <select
              id="category"
              className="input capitalize"
              value={category}
              onChange={(event) => setCategory(event.target.value as TaskCategory)}
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value} className="capitalize">
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="priority" className="label">
              Priority
            </label>
            <select
              id="priority"
              className="input"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="2">Low</option>
              <option value="5">Medium</option>
              <option value="8">High</option>
              <option value="10">Critical</option>
            </select>
          </div>

          <div>
            <label htmlFor="dueDate" className="label">
              Due date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                id="dueDate"
                type="date"
                className="input pl-9"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          <div className="h-px bg-surface-200" />

          <div className="text-xs text-surface-500 space-y-1">
            <p>Updated {formatDate(task.updated_at)}</p>
            {task.github_issue_number && <p>GitHub issue #{task.github_issue_number}</p>}
            {task.github_pr_number && <p>GitHub PR #{task.github_pr_number}</p>}
          </div>
        </aside>
      </form>
    </div>
  );
}
