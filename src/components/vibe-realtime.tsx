'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useRoomStore, useVibeStore, type VibeFileLock } from '@/lib/store';
import type { FileLock, VibeHeartbeat } from '@/types/database';

/**
 * A heartbeat older than this is treated as offline. The MCP server and the
 * IDE extension send one every 30 seconds.
 */
const HEARTBEAT_TTL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

const lockKey = (lock: Pick<FileLock, 'room_id' | 'file_path'>) =>
  `${lock.room_id}-${lock.file_path}`;

function toFileLock(lock: FileLock, userName: string | null): VibeFileLock {
  return {
    id: lock.id,
    roomId: lock.room_id,
    userId: lock.user_id,
    userName,
    filePath: lock.file_path,
    editorType: lock.editor_type,
    expiresAt: new Date(lock.expires_at).getTime(),
  };
}

/**
 * Mirrors the MCP server's IDE telemetry into the dashboard store.
 *
 * The dashboard previously only subscribed to notifications, so the purple
 * "coding now" dots and the file-lock warnings never had any data behind them.
 * This component hydrates the current room's heartbeats and locks, then keeps
 * them in sync through Supabase Realtime.
 */
export function VibeRealtime() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const [supabase] = useState(() => createClient());
  const roomId = useRoomStore((state) => state.currentRoom?.id ?? null);
  const roomMembers = useRoomStore((state) => state.roomMembers);
  const memberNames = useRef(new Map<string, string>());

  useEffect(() => {
    memberNames.current = new Map(
      roomMembers.map((member) => [
        member.user_id,
        member.user.display_name || member.user.username || member.user.email,
      ])
    );
  }, [roomMembers]);

  useEffect(() => {
    if (!roomId) {
      useVibeStore.getState().clearVibeData();
      return;
    }

    useVibeStore.getState().clearVibeData();
    let cancelled = false;

    const nameFor = (userId: string) => memberNames.current.get(userId) ?? null;

    const dropHeartbeatById = (id: string | undefined) => {
      if (!id) return;
      const { heartbeats, removeHeartbeat } = useVibeStore.getState();
      for (const [key, heartbeat] of heartbeats) {
        if (heartbeat.id === id) {
          removeHeartbeat(key);
          return;
        }
      }
    };

    const dropLockById = (id: string | undefined) => {
      if (!id) return;
      const { fileLocks, removeFileLock } = useVibeStore.getState();
      for (const [key, lock] of fileLocks) {
        if (lock.id === id) {
          removeFileLock(key);
          return;
        }
      }
    };

    async function hydrate() {
      const [heartbeatResult, lockResult] = await Promise.all([
        supabase.from('vibe_heartbeats').select('*').eq('room_id', roomId),
        supabase.from('file_locks').select('*').eq('room_id', roomId),
      ]);

      if (cancelled) return;

      const now = Date.now();
      const { updateHeartbeat, setFileLock } = useVibeStore.getState();

      for (const heartbeat of (heartbeatResult.data ?? []) as VibeHeartbeat[]) {
        if (now - new Date(heartbeat.last_heartbeat).getTime() < HEARTBEAT_TTL_MS) {
          updateHeartbeat(heartbeat);
        }
      }

      for (const lock of (lockResult.data ?? []) as FileLock[]) {
        const parsed = toFileLock(lock, nameFor(lock.user_id));
        if (parsed.expiresAt > now) {
          setFileLock(lockKey(lock), parsed);
        }
      }
    }

    void hydrate();

    const channel = supabase
      .channel(`vibe:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vibe_heartbeats',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            dropHeartbeatById((payload.old as Partial<VibeHeartbeat>).id);
            return;
          }

          const heartbeat = payload.new as VibeHeartbeat;
          if (!heartbeat?.room_id) return;

          if (Date.now() - new Date(heartbeat.last_heartbeat).getTime() >= HEARTBEAT_TTL_MS) {
            dropHeartbeatById(heartbeat.id);
            return;
          }

          useVibeStore.getState().updateHeartbeat(heartbeat);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'file_locks',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            dropLockById((payload.old as Partial<FileLock>).id);
            return;
          }

          const lock = payload.new as FileLock;
          if (!lock?.room_id) return;

          const parsed = toFileLock(lock, nameFor(lock.user_id));
          if (parsed.expiresAt <= Date.now()) {
            dropLockById(lock.id);
            return;
          }

          useVibeStore.getState().setFileLock(lockKey(lock), parsed);
        }
      )
      .subscribe();

    const sweep = window.setInterval(() => {
      const now = Date.now();
      const {
        heartbeats,
        removeHeartbeat,
        fileLocks,
        removeFileLock,
      } = useVibeStore.getState();

      for (const [key, heartbeat] of heartbeats) {
        if (now - new Date(heartbeat.last_heartbeat).getTime() >= HEARTBEAT_TTL_MS) {
          removeHeartbeat(key);
        }
      }

      for (const [key, lock] of fileLocks) {
        if (lock.expiresAt <= now) {
          removeFileLock(key);
        }
      }
    }, SWEEP_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(sweep);
      void supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  return null;
}
