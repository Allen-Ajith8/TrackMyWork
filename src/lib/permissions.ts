'use client';

// ============================================================================
// TrackMyWork - Permission Cache
// Caches user roles/permissions at login time so subsequent page loads read
// from localStorage instead of querying Supabase for every permission check.
// ============================================================================

import { useEffect, useState } from 'react';

const CACHE_KEY = 'trackmywork_user_permissions';

export interface CachedRoomPermission {
  role_title: string;
  flag_is_team_leader: boolean;
  flag_can_edit_repo: boolean;
  flag_can_trigger_nim: boolean;
  flag_can_assign_tasks: boolean;
  flag_can_upload_assets: boolean;
  flag_can_manage_bom: boolean;
  flag_can_invite_members: boolean;
  flag_can_edit_rules: boolean;
}

export interface CachedPermissions {
  userId: string;
  is_global_admin: boolean;
  roomPermissions: Record<string, CachedRoomPermission>;
  cachedAt: number;
}

/** Read cached permissions for a user. Returns null if not cached. */
export function getCachedPermissions(userId: string): CachedPermissions | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.userId !== userId) return null;
    return data as CachedPermissions;
  } catch {
    return null;
  }
}

/** Write permissions to cache. */
export function setCachedPermissions(
  userId: string,
  permissions: Omit<CachedPermissions, 'userId' | 'cachedAt'>
): void {
  if (typeof window === 'undefined') return;
  try {
    const data: CachedPermissions = {
      userId,
      ...permissions,
      cachedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

/** Clear cached permissions (e.g. on logout). */
export function clearCachedPermissions(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Hook: read cached permissions for a user. Re-renders when cache changes.
 */
export function useCachedPermissions(
  userId: string | null | undefined
): CachedPermissions | null {
  const [permissions, setPermissions] = useState<CachedPermissions | null>(null);

  useEffect(() => {
    if (!userId) {
      setPermissions(null);
      return;
    }
    const cached = getCachedPermissions(userId);
    setPermissions(cached);
  }, [userId]);

  return permissions;
}

/**
 * Check if a user can perform a specific room action, using cached permissions
 * with a fallback to the raw user/members data.
 */
export function canUserInRoom(
  roomId: string | null | undefined,
  userId: string | null | undefined,
  roomCreatedBy: string | null | undefined,
  cachedPermissions: CachedPermissions | null,
  membersList: any[],
  permission: 'can_edit_repo' | 'can_invite_members' | 'can_trigger_nim' | 'can_assign_tasks' | 'can_upload_assets' | 'can_manage_bom' | 'can_edit_rules' | 'is_team_leader'
): boolean {
  if (!userId) return false;

  // Global admin can do everything
  if (cachedPermissions?.is_global_admin) return true;

  // Room creator can do everything in their room
  if (roomCreatedBy && userId === roomCreatedBy) return true;

  // Check cached room permissions
  if (roomId && cachedPermissions?.roomPermissions?.[roomId]) {
    const rp = cachedPermissions.roomPermissions[roomId];
    switch (permission) {
      case 'is_team_leader':
        return rp.flag_is_team_leader;
      case 'can_edit_repo':
        return rp.flag_can_edit_repo;
      case 'can_invite_members':
        return rp.flag_can_invite_members;
      case 'can_trigger_nim':
        return rp.flag_can_trigger_nim;
      case 'can_assign_tasks':
        return rp.flag_can_assign_tasks;
      case 'can_upload_assets':
        return rp.flag_can_upload_assets;
      case 'can_manage_bom':
        return rp.flag_can_manage_bom;
      case 'can_edit_rules':
        return rp.flag_can_edit_rules;
    }
  }

  // Fallback to live members list
  const member = membersList.find((m) => m.user_id === userId);
  if (!member) return false;
  switch (permission) {
    case 'is_team_leader':
      return Boolean(member.flag_is_team_leader);
    case 'can_edit_repo':
      return Boolean(member.flag_can_edit_repo);
    case 'can_invite_members':
      return Boolean(member.flag_can_invite_members);
    case 'can_trigger_nim':
      return Boolean(member.flag_can_trigger_nim);
    case 'can_assign_tasks':
      return Boolean(member.flag_can_assign_tasks);
    case 'can_upload_assets':
      return Boolean(member.flag_can_upload_assets);
    case 'can_manage_bom':
      return Boolean(member.flag_can_manage_bom);
    case 'can_edit_rules':
      return Boolean(member.flag_can_edit_rules);
  }
  return false;
}
