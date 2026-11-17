'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList, Loader2, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { TaskCategory } from '@/types/database';

export interface RoomMemberOption {
  userId: string;
  name: string;
  role: string;
}

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'code', label: 'Code' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'animation', label: 'Animation' },
  { value: 'design', label: 'Design' },
  { value: 'docs', label: 'Docs' },
  { value: 'pitch', label: 'Pitch' },
];

export function NewTaskClient({
  userId,
  rooms,
  membersByRoom,
}: {
  userId: string;
  rooms: { id: string; name: string }[];
  membersByRoom: Record<string, RoomMemberOption[]>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [roomId, setRoomId] = useState(rooms[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('code');
  const [priority, setPriority] = useState('5');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = useMemo(() => membersByRoom[roomId] || [], [membersByRoom, roomId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!roomId) {
      setError('Choose a room for this task.');
      return;
    }
    if (title.trim().length < 3) {
      setError('Give the task a title with at least 3 characters.');
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from('tasks').insert({
      room_id: roomId,
      created_by: userId,
      title: title.trim(),
      description: description.trim() || null,
      category,
      priority: Number(priority),
      assigned_to: assignedTo || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      status: 'todo',
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    router.push(`/dashboard/rooms/${roomId}/tasks`);
    router.refresh();
  }

  if (rooms.length === 0) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto">
        <ClipboardList className="w-14 h-14 mx-auto text-surface-300" />
        <h1 className="text-xl font-bold text-surface-900 mt-4">Create a room first</h1>
        <p className="text-surface-500 mt-2">
          Tasks belong to a room. Create a room, then add tasks for your team.
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
      <Link href="/dashboard/tasks" className="btn-ghost w-fit">
        <ArrowLeft className="w-4 h-4" />
        Back to tasks
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-surface-900">New task</h1>
        <p className="text-surface-600 mt-1">Add a task to one of your rooms.</p>
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
            onChange={(event) => {
              setRoomId(event.target.value);
              setAssignedTo('');
            }}
            required
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="title" className="label">
            Title
          </label>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Wire up the login screen"
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
            className="input min-h-[110px]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What needs to be done?"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="category" className="label">
              Category
            </label>
            <select
              id="category"
              className="input"
              value={category}
              onChange={(event) => setCategory(event.target.value as TaskCategory)}
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
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
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dueDate" className="label">
              Due date
            </label>
            <input
              id="dueDate"
              type="date"
              className="input"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="assignee" className="label">
              Assign to
            </label>
            <select
              id="assignee"
              className="input"
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
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/dashboard/tasks" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </form>
    </div>
  );
}
