'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, DollarSign, Package, Plus, Search, ShoppingCart } from 'lucide-react';
import { cn, formatCurrency, formatRelativeTime, getBomStatusColor } from '@/lib/utils';
import type { BomStatus, HardwareBomItem } from '@/types/database';

interface BomOverviewClientProps {
  items: (HardwareBomItem & { roomName: string })[];
  rooms: { id: string; name: string }[];
}

const STATUS_FILTERS: { id: 'all' | BomStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'planned', label: 'Planned' },
  { id: 'ordered', label: 'Ordered' },
  { id: 'received', label: 'Received' },
  { id: 'installed', label: 'Installed' },
  { id: 'failed', label: 'Failed' },
];

export function BomOverviewClient({ items, rooms }: BomOverviewClientProps) {
  const [status, setStatus] = useState<'all' | BomStatus>('all');
  const [query, setQuery] = useState('');

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.estimated += Number(item.total_est_cost || item.quantity * (item.unit_est_cost || 0));
        acc.actual += Number(item.total_actual_cost || item.quantity * (item.unit_actual_cost || 0));
        if (item.status === 'received' || item.status === 'installed') acc.received += 1;
        return acc;
      },
      { estimated: 0, actual: 0, received: 0 }
    );
  }, [items]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: items.length };
    for (const item of items) result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = status === 'all' || item.status === status;
      const matchesQuery =
        !needle ||
        item.component.toLowerCase().includes(needle) ||
        item.roomName.toLowerCase().includes(needle) ||
        (item.notes || '').toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [items, status, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Hardware BOM</h1>
          <p className="text-surface-600 mt-1">
            Budget and component tracking across all your rooms.
          </p>
        </div>
        <Link href="/dashboard/bom/new" className="btn-primary">
          <Plus className="w-5 h-5" />
          Add BOM Item
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500">Components</p>
              <p className="text-2xl font-bold text-surface-900 mt-1">{items.length}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500">Received / installed</p>
              <p className="text-2xl font-bold text-surface-900 mt-1">{totals.received}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-green-500 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500">Estimated spend</p>
              <p className="text-2xl font-bold text-surface-900 mt-1">
                {formatCurrency(totals.estimated)}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500">Actual spend</p>
              <p className="text-2xl font-bold text-surface-900 mt-1">
                {formatCurrency(totals.actual)}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            className="input pl-9"
            placeholder="Search components, rooms or notes…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatus(filter.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                status === filter.id
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
              )}
            >
              {filter.label}
              <span className={cn('ml-2 text-xs', status === filter.id ? 'text-white/80' : 'text-surface-400')}>
                {counts[filter.id] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-14 h-14 mx-auto text-surface-300" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900">
            {rooms.length === 0 ? 'No rooms yet' : 'No BOM items found'}
          </h3>
          <p className="text-surface-500 mt-1 max-w-md mx-auto">
            {rooms.length === 0
              ? 'Create a room first, then start tracking hardware costs.'
              : 'Add a component or adjust your filters.'}
          </p>
          <Link
            href={rooms.length === 0 ? '/dashboard/rooms/new' : '/dashboard/bom/new'}
            className="btn-primary mt-6"
          >
            <Plus className="w-4 h-4" />
            {rooms.length === 0 ? 'Create a room' : 'Add component'}
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_1fr_90px_120px_130px_40px] gap-4 px-4 py-3 bg-surface-50 border-b border-surface-200 text-xs font-semibold uppercase tracking-wide text-surface-500">
            <span>Component</span>
            <span>Room</span>
            <span>Qty</span>
            <span>Total</span>
            <span>Status</span>
            <span />
          </div>
          <div className="divide-y divide-surface-200">
            {filtered.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/rooms/${item.room_id}/bom`}
                className="grid md:grid-cols-[minmax(0,2fr)_1fr_90px_120px_130px_40px] gap-2 md:gap-4 px-4 py-4 hover:bg-surface-50 transition-colors items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium text-surface-900 truncate">{item.component}</p>
                  <p className="text-xs text-surface-500 truncate">
                    {item.notes || `Added ${formatRelativeTime(item.created_at)}`}
                  </p>
                </div>
                <span className="text-sm text-surface-600 truncate">{item.roomName}</span>
                <span className="text-sm text-surface-600">{item.quantity}</span>
                <span className="text-sm font-medium text-surface-900">
                  {formatCurrency(
                    Number(item.total_est_cost || item.quantity * (item.unit_est_cost || 0))
                  )}
                </span>
                <span className={cn('badge', getBomStatusColor(item.status))}>{item.status}</span>
                <ArrowRight className="hidden md:block w-4 h-4 text-surface-400" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
