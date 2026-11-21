'use client';

import { useState, useEffect } from 'react';
import { Flame, X, ShieldAlert } from 'lucide-react';
import { useRoomStore } from '@/lib/store';
import { usePanicTasks } from '@/hooks/usePanicTasks';

export function PanicModeBanner() {
  const [mounted, setMounted] = useState(false);
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const { isPanicMode, togglePanicMode, blockerCount, urgentCount } = usePanicTasks({
    roomId: currentRoom?.id,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !currentRoom || !isPanicMode) {
    return null;
  }

  const blockerLabel = `${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`;
  const urgentLabel = `${urgentCount} urgent task${urgentCount === 1 ? '' : 's'}`;

  return (
    <div
      role="alert"
      className="bg-accent text-accent-foreground border-b border-accent-600 px-3 sm:px-6 py-2 shadow-sm transition-all"
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto gap-2 text-xs sm:text-sm font-semibold">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-black/15 flex items-center justify-center flex-shrink-0">
            <Flame className="w-4 h-4 text-accent-foreground fill-current animate-pulse" />
          </div>
          <span className="truncate">
            <strong className="tracking-wide uppercase font-bold">PANIC MODE:</strong>{' '}
            showing {blockerLabel} + {urgentLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={() => togglePanicMode()}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-black/20 hover:bg-black/30 text-accent-foreground text-xs font-bold transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-black"
        >
          <span>Exit</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
