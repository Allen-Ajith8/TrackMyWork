'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Flame, X, Edit3, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useRoomStore } from '@/lib/store';
import { usePanicTasks } from '@/hooks/usePanicTasks';
import {
  formatRemainingTime,
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

  const currentMember = roomMembers.find((m) => m.user_id === currentUserId);
  const canEditDeadline =
    isGlobalAdmin || isTeamLeader || Boolean(currentMember?.flag_can_edit_rules);

  const { isPanicMode, setPanicMode } = usePanicTasks({ roomId: currentRoom?.id });

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
      .channel(`room-timer-${currentRoom.id}`)
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

  // Calculate remaining time
  const deadlineMs = currentRoom?.submission_deadline
    ? new Date(currentRoom.submission_deadline).getTime()
    : null;
  const remainingMs = deadlineMs !== null ? deadlineMs - now : null;
  const timerState: HackTimerState =
    remainingMs !== null ? getHackTimerState(remainingMs) : 'normal';

  // Screen-reader announcement only on threshold changes
  const prevStateRef = useRef<HackTimerState | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (remainingMs === null) return;
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
  }, [timerState, remainingMs]);

  // Under 2h toast suggestion (once per room per session)
  useEffect(() => {
    if (
      !mounted ||
      !currentRoom?.id ||
      isPanicMode ||
      remainingMs === null ||
      remainingMs <= 0 ||
      remainingMs > 2 * 60 * 60 * 1000
    ) {
      return;
    }

    try {
      const key = `panic_suggested_${currentRoom.id}`;
      const alreadySuggested = sessionStorage.getItem(key);
      if (!alreadySuggested) {
        setShowToast(true);
        sessionStorage.setItem(key, 'true');
      }
    } catch {
      // ignore storage errors
    }
  }, [mounted, currentRoom?.id, remainingMs, isPanicMode]);

  // Handle open deadline dialog
  const handleOpenDialog = () => {
    if (currentRoom?.submission_deadline) {
      try {
        const d = new Date(currentRoom.submission_deadline);
        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setDeadlineInput(isoLocal);
      } catch {
        setDeadlineInput('');
      }
    } else {
      // Default to 24 hours from now
      const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDeadlineInput(isoLocal);
    }
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSaveDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoom) return;

    if (!deadlineInput) {
      setSaveError('Please select a valid date and time.');
      return;
    }

    const isoDate = new Date(deadlineInput).toISOString();

    startTransition(async () => {
      setSaveError(null);
      try {
        const { error } = await supabase
          .from('rooms')
          .update({ submission_deadline: isoDate })
          .eq('id', currentRoom.id);

        if (error) {
          // If Supabase is offline/unconfigured, update local room state directly for demo mode
          setCurrentRoom({
            ...currentRoom,
            submission_deadline: isoDate,
          });
          setDialogOpen(false);
        } else {
          setCurrentRoom({
            ...currentRoom,
            submission_deadline: isoDate,
          });
          setDialogOpen(false);
        }
      } catch {
        // Fallback for offline/demo mode
        setCurrentRoom({
          ...currentRoom,
          submission_deadline: isoDate,
        });
        setDialogOpen(false);
      }
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
      <div className="h-8 w-24 bg-surface-200/50 rounded-lg animate-pulse" aria-hidden="true" />
    );
  }

  // If no room is active, render nothing
  if (!currentRoom) {
    return null;
  }

  // If no deadline set
  if (!currentRoom.submission_deadline || remainingMs === null) {
    if (!canEditDeadline) return null;

    return (
      <>
        <button
          onClick={handleOpenDialog}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-surface-300 hover:bg-surface-100 text-surface-700 transition-colors shadow-sm"
          title="Set room submission deadline"
        >
          <Calendar className="w-3.5 h-3.5 text-primary-600" />
          <span>Set deadline</span>
        </button>

        {/* Dialog for setting deadline */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-600" />
                Set Submission Deadline
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveDeadline} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deadline-input">Final Submission Deadline</Label>
                <Input
                  id="deadline-input"
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
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 text-surface-700"
                  >
                    +1h (Testing)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetHours(6)}
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 text-surface-700"
                  >
                    +6h
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetHours(24)}
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 text-surface-700"
                  >
                    +24h
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetHours(48)}
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 text-surface-700"
                  >
                    +48h
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
                  {isPending ? 'Saving…' : 'Save Deadline'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // State-specific styling
  const stateStyles = {
    normal:
      'bg-surface-100 text-surface-800 border-surface-200 hover:bg-surface-200/80',
    warning:
      'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
    critical:
      'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse-subtle hover:bg-red-500/20',
    passed:
      'bg-surface-200 text-surface-600 border-surface-300 hover:bg-surface-300/80',
  };

  const stateIcons = {
    normal: <Clock className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />,
    critical: <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />,
    passed: <CheckCircle2 className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />,
  };

  const timeDisplay = formatRemainingTime(remainingMs);

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
            stateStyles[timerState],
            canEditDeadline ? 'cursor-pointer' : 'cursor-default'
          )}
          title={
            canEditDeadline
              ? `Deadline: ${new Date(currentRoom.submission_deadline).toLocaleString()} (click to edit)`
              : `Deadline: ${new Date(currentRoom.submission_deadline).toLocaleString()}`
          }
        >
          {stateIcons[timerState]}
          <span aria-live="off" className="tabular-nums tracking-tight">
            {timeDisplay}
          </span>
          {canEditDeadline && (
            <Edit3 className="w-2.5 h-2.5 opacity-40 hover:opacity-100 ml-0.5" />
          )}
        </button>
      </div>

      {/* Under 2h Suggestion Toast */}
      {showToast && !isPanicMode && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-accent/40 bg-white/95 p-4 shadow-xl backdrop-blur-md animate-slide-in flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 text-accent-700">
            <Flame className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-surface-900 uppercase tracking-wider">
              Under 2h Remaining!
            </h4>
            <p className="text-xs text-surface-600 mt-0.5">
              Less than 2 hours left before deadline. Enable Panic Mode to focus exclusively on blockers and urgent tasks?
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                onClick={() => {
                  setPanicMode(true);
                  setShowToast(false);
                }}
                className="h-7 text-xs bg-accent text-accent-foreground font-bold hover:brightness-110"
              >
                Enable Panic Mode
              </Button>
              <button
                type="button"
                onClick={() => setShowToast(false)}
                className="text-xs text-surface-500 hover:text-surface-700 font-medium px-2 py-1"
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
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 text-surface-700"
                  >
                    +1h (Testing)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetHours(2)}
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 text-surface-700"
                  >
                    +2h
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetHours(6)}
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 text-surface-700"
                  >
                    +6h
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetHours(24)}
                    className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-surface-200 text-surface-700"
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
