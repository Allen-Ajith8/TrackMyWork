'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Flame, X, Edit3, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useRoomStore } from '@/lib/store';
import { usePanicTasks } from '@/hooks/usePanicTasks';
import {
  getHackTimerState,
  type HackTimerState,
  cn,
} from '@/lib/utils';
import type { Room } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Counter } from '@/components/ui/counter';

export function HackTimer() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);

  const [supabase] = useState(() => createClient());
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const setCurrentRoom = useRoomStore((state) => state.setCurrentRoom);
  const isTeamLeader = useRoomStore((state) => state.isTeamLeader);
  const isGlobalAdmin = useRoomStore((state) => state.isGlobalAdmin);
  const roomMembers = useRoomStore((state) => state.roomMembers);
  const currentUserId = useAuthStore((state) => state.user?.id);

  const effectiveRoomId = currentRoom?.id ?? 'demo-room-01';
  const currentMember = roomMembers.find((m) => m.user_id === currentUserId);
  const canEditDeadline =
    isGlobalAdmin || isTeamLeader || Boolean(currentMember?.flag_can_edit_rules) || !currentRoom;

  const { isPanicMode, setPanicMode } = usePanicTasks({ roomId: effectiveRoomId });

  // Fallback demo deadline (90 mins from session start if none configured)
  const defaultDeadlineRef = useRef<number>(Date.now() + 90 * 60 * 1000);

  // SSR-safe mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Tick every 1 second, recalculate on visibilitychange
  useEffect(() => {
    const updateTime = () => setNow(Date.now());
    const interval = setInterval(updateTime, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateTime();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Realtime subscription to room changes
  useEffect(() => {
    if (!currentRoom?.id) return;

    const channel = supabase
      .channel(`room-timer-${currentRoom.id}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${currentRoom.id}`,
        },
        (payload) => {
          const updated = payload.new as Room;
          if (updated && updated.id === currentRoom.id) {
            setCurrentRoom({
              ...currentRoom,
              submission_deadline: updated.submission_deadline,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom?.id, currentRoom, setCurrentRoom]);

  // Calculate remaining time with fallback to ensure timer is always active
  const deadlineMs = currentRoom?.submission_deadline
    ? new Date(currentRoom.submission_deadline).getTime()
    : defaultDeadlineRef.current;
  const remainingMs = deadlineMs - now;
  const timerState: HackTimerState = getHackTimerState(remainingMs);

  // Screen-reader announcement only on threshold changes
  const prevStateRef = useRef<HackTimerState | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (timerState !== prevStateRef.current) {
      prevStateRef.current = timerState;
      if (timerState === 'passed') {
        setAnnouncement('Submissions are now closed.');
      } else if (timerState === 'critical') {
        setAnnouncement('Critical alert: Less than 2 hours remaining until submission deadline.');
      } else if (timerState === 'warning') {
        setAnnouncement('Warning: Less than 6 hours remaining until submission deadline.');
      } else {
        setAnnouncement('Hackathon submission timer is in normal state.');
      }
    }
  }, [timerState]);

  // Under 2h toast suggestion (once per room per session)
  useEffect(() => {
    if (
      !mounted ||
      !effectiveRoomId ||
      isPanicMode ||
      remainingMs <= 0 ||
      remainingMs > 2 * 60 * 60 * 1000
    ) {
      return;
    }

    try {
      const key = `panic_suggested_${effectiveRoomId}`;
      const alreadySuggested = sessionStorage.getItem(key);
      if (!alreadySuggested) {
        setShowToast(true);
        sessionStorage.setItem(key, 'true');
      }
    } catch {
      // ignore storage errors
    }
  }, [mounted, effectiveRoomId, remainingMs, isPanicMode]);

  // Handle open deadline dialog
  const handleOpenDialog = () => {
    const targetMs = currentRoom?.submission_deadline
      ? new Date(currentRoom.submission_deadline).getTime()
      : defaultDeadlineRef.current;
    try {
      const d = new Date(targetMs);
      const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDeadlineInput(isoLocal);
    } catch {
      setDeadlineInput('');
    }
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSaveDeadline = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deadlineInput) {
      setSaveError('Please select a valid date and time.');
      return;
    }

    const isoDate = new Date(deadlineInput).toISOString();
    defaultDeadlineRef.current = new Date(isoDate).getTime();

    startTransition(async () => {
      setSaveError(null);
      if (currentRoom) {
        try {
          const { error } = await supabase
            .from('rooms')
            .update({ submission_deadline: isoDate })
            .eq('id', currentRoom.id);

          if (error) {
            setCurrentRoom({
              ...currentRoom,
              submission_deadline: isoDate,
            });
          } else {
            setCurrentRoom({
              ...currentRoom,
              submission_deadline: isoDate,
            });
          }
        } catch {
          setCurrentRoom({
            ...currentRoom,
            submission_deadline: isoDate,
          });
        }
      }
      setDialogOpen(false);
    });
  };

  const setPresetHours = (hours: number) => {
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    const isoLocal = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDeadlineInput(isoLocal);
  };

  // SSR placeholder
  if (!mounted) {
    return (
      <div className="h-8 w-28 bg-surface-200/50 dark:bg-slate-800/50 rounded-lg animate-pulse" aria-hidden="true" />
    );
  }

  // Decompose remainingMs into hours, minutes, and seconds for rolling digit animation
  const isExpired = remainingMs <= 0;
  const safeRemainingMs = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(safeRemainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Styling
  const normalStyles = {
    normal:
      'bg-surface-100 text-surface-800 dark:bg-slate-900/60 dark:text-surface-200 border-surface-200 dark:border-slate-800 hover:bg-surface-200/80',
    warning:
      'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
    critical:
      'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse-subtle hover:bg-red-500/20',
    passed:
      'bg-surface-200 text-surface-600 dark:bg-slate-800 dark:text-slate-400 border-surface-300 dark:border-slate-700 hover:bg-surface-300/80',
  };

  const panicStyles =
    'bg-orange-500/15 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-500/60 shadow-[0_0_14px_rgba(249,115,22,0.3)] hover:bg-orange-500/25';

  const stateIcons = {
    normal: <Clock className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />,
    critical: <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />,
    passed: <CheckCircle2 className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />,
  };

  const counterTextColor = isPanicMode
    ? '#f97316'
    : timerState === 'critical'
    ? '#ef4444'
    : timerState === 'warning'
    ? '#f59e0b'
    : undefined;

  return (
    <>
      {/* Screen-reader announcement container */}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={canEditDeadline ? handleOpenDialog : undefined}
          disabled={!canEditDeadline}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all duration-200 shadow-sm',
            isPanicMode ? panicStyles : normalStyles[timerState],
            canEditDeadline ? 'cursor-pointer' : 'cursor-default'
          )}
          title={`Submission Deadline: ${new Date(deadlineMs).toLocaleString()} (click to edit)`}
        >
          {isPanicMode ? (
            <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500/20 animate-pulse flex-shrink-0" />
          ) : (
            stateIcons[timerState]
          )}

          {isExpired ? (
            <span aria-live="off" className="tabular-nums tracking-tight font-medium">
              Submissions closed
            </span>
          ) : (
            <span aria-live="off" className="inline-flex items-baseline gap-0.5 tabular-nums tracking-tight font-bold">
              <Counter
                value={hours}
                minDigits={2}
                fontSize={12}
                fontWeight={700}
                textColor={counterTextColor}
                direction="down"
                duration={0.6}
              />
              <span className={cn('text-[10px] font-semibold opacity-70 mr-1', isPanicMode ? 'text-orange-500' : 'text-current')}>
                h
              </span>

              <Counter
                value={minutes}
                minDigits={2}
                fontSize={12}
                fontWeight={700}
                textColor={counterTextColor}
                direction="down"
                duration={0.6}
              />
              <span className={cn('text-[10px] font-semibold opacity-70 mr-1', isPanicMode ? 'text-orange-500' : 'text-current')}>
                m
              </span>

              <Counter
                value={seconds}
                minDigits={2}
                fontSize={12}
                fontWeight={700}
                textColor={counterTextColor}
                direction="down"
                duration={0.35}
              />
              <span className={cn('text-[10px] font-semibold opacity-70', isPanicMode ? 'text-orange-500' : 'text-current')}>
                s
              </span>
            </span>
          )}

          {canEditDeadline && (
            <Edit3 className={cn("w-2.5 h-2.5 opacity-40 hover:opacity-100 ml-0.5", isPanicMode && "text-orange-500 opacity-70")} />
          )}
        </button>
      </div>

      {/* Under 2h Suggestion Toast */}
      {showToast && !isPanicMode && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-accent/40 bg-white/95 dark:bg-slate-900/95 p-4 shadow-xl backdrop-blur-md animate-slide-in flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0 text-orange-600">
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-surface-900 dark:text-surface-100 uppercase tracking-wider">
              Under 2h Remaining!
            </h4>
            <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">
              Less than 2 hours left before deadline. Enable Panic Mode to focus exclusively on blockers and urgent tasks?
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                onClick={() => {
                  setPanicMode(true);
                  setShowToast(false);
                }}
                className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold"
              >
                Enable Panic Mode
              </Button>
              <button
                type="button"
                onClick={() => setShowToast(false)}
                className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 font-medium px-2 py-1"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowToast(false)}
            className="text-surface-400 hover:text-surface-600 p-0.5"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Edit deadline dialog */}
      {canEditDeadline && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-600" />
                Edit Submission Deadline
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveDeadline} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deadline-input-edit">Final Submission Deadline</Label>
                <Input
                  id="deadline-input-edit"
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-surface-500">Quick Presets</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPresetHours(1)}
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-700 dark:text-surface-300"
                  >
                    +1h (Testing)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetHours(2)}
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-700 dark:text-surface-300"
                  >
                    +2h
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetHours(6)}
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-700 dark:text-surface-300"
                  >
                    +6h
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetHours(24)}
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-700 dark:text-surface-300"
                  >
                    +24h
                  </button>
                </div>
              </div>

              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {saveError}
                </p>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Update Deadline'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
export default HackTimer;
