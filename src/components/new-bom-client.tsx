'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Package, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { BomStatus } from '@/types/database';

const STATUSES: BomStatus[] = ['planned', 'ordered', 'received', 'installed', 'failed'];

export function NewBomClient({ rooms }: { rooms: { id: string; name: string }[] }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [roomId, setRoomId] = useState(rooms[0]?.id || '');
  const [component, setComponent] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [status, setStatus] = useState<BomStatus>('planned');
  const [supplierUrl, setSupplierUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!roomId) {
      setError('Choose a room for this component.');
      return;
    }
    if (!component.trim()) {
      setError('Enter a component name.');
      return;
    }

    const qty = Math.max(1, Number(quantity) || 1);
    const cost = unitCost ? Number(unitCost) : null;

    setSaving(true);
    const { error: insertError } = await supabase.from('hardware_bom').insert({
      room_id: roomId,
      component: component.trim(),
      quantity: qty,
      unit_est_cost: cost,
      total_est_cost: cost ? cost * qty : 0,
      status,
      supplier_url: supplierUrl.trim() || null,
      notes: notes.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    router.push(`/dashboard/rooms/${roomId}/bom`);
    router.refresh();
  }

  if (rooms.length === 0) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto">
        <Package className="w-14 h-14 mx-auto text-surface-300" />
        <h1 className="text-xl font-bold text-surface-900 mt-4">Create a room first</h1>
        <p className="text-surface-500 mt-2">
          BOM items belong to a room. Create a room, then start tracking hardware.
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
      <Link href="/dashboard/bom" className="btn-ghost w-fit">
        <ArrowLeft className="w-4 h-4" />
        Back to BOM
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-surface-900">Add BOM item</h1>
        <p className="text-surface-600 mt-1">Track a component and its estimated cost.</p>
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
            onChange={(event) => setRoomId(event.target.value)}
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
          <label htmlFor="component" className="label">
            Component
          </label>
          <input
            id="component"
            className="input"
            value={component}
            onChange={(event) => setComponent(event.target.value)}
            placeholder="e.g. ESP32-S3 dev board"
            maxLength={140}
            required
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="quantity" className="label">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min={1}
              className="input"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="unitCost" className="label">
              Unit cost (USD)
            </label>
            <input
              id="unitCost"
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={unitCost}
              onChange={(event) => setUnitCost(event.target.value)}
              placeholder="12.50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select
            id="status"
            className="input capitalize"
            value={status}
            onChange={(event) => setStatus(event.target.value as BomStatus)}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value} className="capitalize">
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="supplierUrl" className="label">
            Supplier URL
          </label>
          <input
            id="supplierUrl"
            type="url"
            className="input"
            value={supplierUrl}
            onChange={(event) => setSupplierUrl(event.target.value)}
            placeholder="https://…"
          />
        </div>

        <div>
          <label htmlFor="notes" className="label">
            Notes
          </label>
          <textarea
            id="notes"
            className="input min-h-[90px]"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Alternatives, shipping notes, etc."
          />
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/dashboard/bom" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Adding…' : 'Add item'}
          </button>
        </div>
      </form>
    </div>
  );
}
