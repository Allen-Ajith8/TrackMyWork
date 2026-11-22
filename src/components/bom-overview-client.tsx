'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, DollarSign, Package, Plus, Search, ShoppingCart } from 'lucide-react';
import { cn, formatCurrency, formatRelativeTime, getBomStatusColor } from '@/lib/utils';
import { GlassIconTile } from '@/components/ui/glass-icons';
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
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Hardware BOM</h1>
          <p className="text-surface-600 dark:text-slate-400 mt-1">
            Budget and component tracking across all your rooms.
          </p>
        </div>
        <Link
          href="/dashboard/bom/new"
          className="btn-primary flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-md shadow-purple-950/30 rounded-xl px-4 py-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add BOM Item</span>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Components */}
        <div
          onClick={() => setStatus('all')}
          className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#faf5ff] via-[#fdf4ff] to-[#f3e8ff] border-purple-100/90 hover:border-purple-200 dark:bg-gradient-to-br dark:from-[#26153c] dark:via-[#190d29] dark:to-[#0f071a] dark:border-purple-800/50 dark:hover:border-purple-600/70 dark:shadow-purple-950/20"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 bg-purple-400/20 dark:bg-purple-500/20" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600 dark:text-purple-200/70">Components</p>
              <p className="text-3xl font-bold mt-1 transition-colors text-surface-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300">
                {items.length}
              </p>
            </div>
            <div className="shrink-0 -mt-1 -mr-1 transition-transform duration-300 group-hover:scale-105">
              <GlassIconTile
                icon={<Package className="w-5 h-5 text-white" />}
                color="purple"
                size={46}
                roundness={0.58}
                plate="tilt"
                tilt={24}
                hover="float"
              />
            </div>
          </div>
        </div>

        {/* Received / installed */}
        <div
          onClick={() => setStatus('received')}
          className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#ecfdf5] via-[#f6fef9] to-[#d1fae5] border-emerald-100/90 hover:border-emerald-200 dark:bg-gradient-to-br dark:from-[#0b281d] dark:via-[#071d15] dark:to-[#04120d] dark:border-emerald-700/50 dark:hover:border-emerald-600/70 dark:shadow-emerald-950/20"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 bg-emerald-400/20 dark:bg-emerald-500/20" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600 dark:text-emerald-200/70">Received / installed</p>
              <p className="text-3xl font-bold mt-1 transition-colors text-surface-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                {totals.received}
              </p>
            </div>
            <div className="shrink-0 -mt-1 -mr-1 transition-transform duration-300 group-hover:scale-105">
              <GlassIconTile
                icon={<ShoppingCart className="w-5 h-5 text-white" />}
                color="green"
                size={46}
                roundness={0.58}
                plate="tilt"
                tilt={24}
                hover="float"
              />
            </div>
          </div>
        </div>

        {/* Estimated spend */}
        <div
          className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#eff6ff] via-[#f8faff] to-[#eef2ff] border-blue-100/90 hover:border-blue-200 dark:bg-gradient-to-br dark:from-[#11192e] dark:via-[#0c1424] dark:to-[#080d19] dark:border-blue-900/50 dark:hover:border-blue-700/60 dark:shadow-blue-950/20"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 bg-blue-400/20 dark:bg-blue-500/15" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600 dark:text-slate-400">Estimated spend</p>
              <p className="text-3xl font-bold mt-1 transition-colors text-surface-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300">
                {formatCurrency(totals.estimated)}
              </p>
            </div>
            <div className="shrink-0 -mt-1 -mr-1 transition-transform duration-300 group-hover:scale-105">
              <GlassIconTile
                icon={<DollarSign className="w-5 h-5 text-white" />}
                color="blue"
                size={46}
                roundness={0.58}
                plate="tilt"
                tilt={24}
                hover="float"
              />
            </div>
          </div>
        </div>

        {/* Actual spend */}
        <div
          className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#fff7ed] via-[#fffbf5] to-[#ffedd5] border-amber-100/90 hover:border-amber-200 dark:bg-gradient-to-br dark:from-[#352511] dark:via-[#261909] dark:to-[#170e04] dark:border-amber-700/50 dark:hover:border-amber-600/70 dark:shadow-amber-950/20"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-transform duration-300 group-hover:scale-125 bg-amber-400/20 dark:bg-amber-500/20" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-surface-600 dark:text-amber-200/70">Actual spend</p>
              <p className="text-3xl font-bold mt-1 transition-colors text-surface-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-amber-300">
                {formatCurrency(totals.actual)}
              </p>
            </div>
            <div className="shrink-0 -mt-1 -mr-1 transition-transform duration-300 group-hover:scale-105">
              <GlassIconTile
                icon={<DollarSign className="w-5 h-5 text-white" />}
                color="orange"
                size={46}
                roundness={0.58}
                plate="tilt"
                tilt={24}
                hover="float"
              />
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
                  : 'bg-white dark:bg-slate-900/80 text-surface-600 dark:text-slate-300 border-surface-200 dark:border-slate-800 hover:bg-surface-50 dark:hover:bg-slate-800 dark:hover:text-white'
              )}
            >
              {filter.label}
              <span className={cn('ml-2 text-xs', status === filter.id ? 'text-white/80' : 'text-surface-400 dark:text-slate-500')}>
                {counts[filter.id] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-14 h-14 mx-auto text-surface-300 dark:text-slate-600" />
          <h3 className="mt-4 text-lg font-semibold text-surface-900 dark:text-white">
            {rooms.length === 0 ? 'No rooms yet' : 'No BOM items found'}
          </h3>
          <p className="text-surface-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
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
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_1fr_90px_120px_130px_40px] gap-4 px-4 py-3 bg-surface-50 dark:bg-slate-900/80 border-b border-surface-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-slate-400">
            <span>Component</span>
            <span>Room</span>
            <span>Qty</span>
            <span>Total</span>
            <span>Status</span>
            <span />
          </div>
          <div className="divide-y divide-surface-200 dark:divide-slate-800">
            {filtered.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/rooms/${item.room_id}/bom`}
                className="grid md:grid-cols-[minmax(0,2fr)_1fr_90px_120px_130px_40px] gap-2 md:gap-4 px-4 py-4 hover:bg-surface-50 dark:hover:bg-slate-800/40 transition-colors items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium text-surface-900 dark:text-white truncate">{item.component}</p>
                  <p className="text-xs text-surface-500 dark:text-slate-400 truncate">
                    {item.notes || `Added ${formatRelativeTime(item.created_at)}`}
                  </p>
                </div>
                <span className="text-sm text-surface-600 dark:text-slate-300 truncate">{item.roomName}</span>
                <span className="text-sm text-surface-600 dark:text-slate-300">{item.quantity}</span>
                <span className="text-sm font-medium text-surface-900 dark:text-white">
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
