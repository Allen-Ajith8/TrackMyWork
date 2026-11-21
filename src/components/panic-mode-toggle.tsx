'use client';

import { useState, useEffect } from 'react';
import { Flame, ShieldAlert, Zap } from 'lucide-react';
import { useRoomStore } from '@/lib/store';
import { usePanicTasks } from '@/hooks/usePanicTasks';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

export function PanicModeToggle() {
  const [mounted, setMounted] = useState(false);
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const { isPanicMode, togglePanicMode, blockerCount, urgentCount } = usePanicTasks({
    roomId: currentRoom?.id,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !currentRoom) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Interactive toggle container */}
      <button
        type="button"
        onClick={() => togglePanicMode()}
        aria-pressed={isPanicMode}
        title={
          isPanicMode
            ? `Panic Mode is ON (${blockerCount} blockers, ${urgentCount} urgent). Click to exit.`
            : 'Toggle Panic Mode: focus only on blockers and tasks due in next 2 hours'
        }
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 border',
          isPanicMode
            ? 'bg-accent text-accent-foreground border-accent shadow-sm animate-glow-orange'
            : 'bg-surface-100 text-surface-600 hover:text-surface-900 border-surface-200 hover:bg-surface-200/80'
        )}
      >
        <Flame
          className={cn(
            'w-3.5 h-3.5 transition-transform duration-200',
            isPanicMode ? 'text-accent-foreground fill-current animate-pulse' : 'text-surface-400'
          )}
        />
        {/* Full text on screens >= 480px, compact icon badge on small screens */}
        <span className="hidden sm:inline">Panic Mode</span>
        <span
          className={cn(
            'px-1.5 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider',
            isPanicMode
              ? 'bg-black/20 text-accent-foreground'
              : 'bg-surface-200 text-surface-600'
          )}
        >
          {isPanicMode ? 'ON' : 'OFF'}
        </span>
      </button>

      {/* Switch component for accessibility */}
      <div className="hidden md:flex items-center">
        <Switch
          id="panic-mode-switch"
          checked={isPanicMode}
          onCheckedChange={togglePanicMode}
          aria-label="Toggle Panic Mode"
          className="data-[state=checked]:bg-accent"
        />
      </div>
    </div>
  );
}
