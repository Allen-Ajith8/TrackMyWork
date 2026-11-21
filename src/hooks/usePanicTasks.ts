'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRoomStore, useTaskStore, usePanicStore } from '@/lib/store';
import { getPanicTasks, type PanicTaskLike } from '@/lib/utils';
import type { Task } from '@/types/database';

export interface UsePanicTasksOptions<T extends PanicTaskLike = Task> {
  tasks?: T[];
  roomId?: string | null;
}

export function usePanicTasks<T extends PanicTaskLike = Task>(
  options?: UsePanicTasksOptions<T>
) {
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const storeTasks = useTaskStore((state) => state.tasks) as unknown as T[];
  const roomId = options?.roomId ?? currentRoom?.id ?? null;

  const rawTasks = options?.tasks ?? storeTasks;

  const panicModeByRoom = usePanicStore((state) => state.panicModeByRoom);
  const setStorePanicMode = usePanicStore((state) => state.setPanicMode);
  const toggleStorePanicMode = usePanicStore((state) => state.togglePanicMode);

  const isPanicMode = Boolean(roomId && panicModeByRoom[roomId]);

  // Keep a `now` state that ticks every minute so tasks enter the 2-hour window automatically
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const interval = setInterval(updateNow, 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Update HTML data-panic attribute on document element
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isPanicMode) {
      root.setAttribute('data-panic', 'true');
    } else {
      root.removeAttribute('data-panic');
    }
  }, [isPanicMode]);

  // Filter panic tasks pure calculation
  const panicTasks = useMemo(() => {
    return getPanicTasks(rawTasks, now);
  }, [rawTasks, now]);

  const blockerCount = useMemo(() => {
    return panicTasks.filter((t) => t.is_blocker || t.status === 'blocked').length;
  }, [panicTasks]);

  const urgentCount = useMemo(() => {
    return panicTasks.filter((t) => !(t.is_blocker || t.status === 'blocked')).length;
  }, [panicTasks]);

  const togglePanicMode = useCallback(() => {
    if (roomId) {
      toggleStorePanicMode(roomId);
    }
  }, [roomId, toggleStorePanicMode]);

  const setPanicMode = useCallback(
    (enabled: boolean) => {
      if (roomId) {
        setStorePanicMode(roomId, enabled);
      }
    },
    [roomId, setStorePanicMode]
  );

  return {
    isPanicMode,
    togglePanicMode,
    setPanicMode,
    panicTasks,
    displayedTasks: isPanicMode ? panicTasks : rawTasks,
    blockerCount,
    urgentCount,
    bannerText: `PANIC MODE: showing ${blockerCount} blocker${blockerCount === 1 ? '' : 's'} + ${urgentCount} urgent task${urgentCount === 1 ? '' : 's'}`,
    isEmpty: isPanicMode && panicTasks.length === 0,
    emptyMessage: 'No blockers, nothing due in the next 2h',
  };
}
