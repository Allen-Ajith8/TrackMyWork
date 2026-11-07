import type { User as AuthUser } from '@supabase/supabase-js';
import type { User } from '@/types/database';

export interface ProfileMetadata {
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  headline?: string | null;
  full_name?: string | null;
  name?: string | null;
  picture?: string | null;
  is_global_admin?: boolean | null;
  [key: string]: unknown;
}

export interface ProfileValues {
  displayName: string;
  username: string;
  headline: string;
  avatarUrl: string;
}

export function getProfileMetadata(user: AuthUser | null | undefined): ProfileMetadata {
  return (user?.user_metadata as ProfileMetadata | undefined) ?? {};
}

export function sanitizeUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

export function isUsernameValid(value: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(value);
}

/** Handles that should never belong to a user account. */
export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'support',
  'help',
  'official',
  'trackmywork',
  'api',
  'auth',
  'dashboard',
  'settings',
  'profile',
  'team',
  'rooms',
  'tasks',
  'bom',
  'artifacts',
  'null',
  'undefined',
]);

/**
 * Returns a human-readable error, or null when the username is acceptable.
 * An empty username is allowed (username is optional).
 */
export function validateUsername(value: string): string | null {
  if (!value) return null;

  if (value.length < 3) {
    return 'Username must be at least 3 characters.';
  }
  if (value.length > 20) {
    return 'Username must be 20 characters or fewer.';
  }
  if (!/^[a-z0-9_]+$/.test(value)) {
    return 'Use lowercase letters, numbers and underscores only.';
  }
  if (RESERVED_USERNAMES.has(value)) {
    return 'That username is reserved. Please choose another.';
  }

  return null;
}

export function getDisplayName(
  metadata: ProfileMetadata,
  fallback = 'Member'
): string {
  return (
    metadata.display_name?.trim() ||
    metadata.full_name?.trim() ||
    metadata.name?.trim() ||
    metadata.username?.trim() ||
    fallback
  );
}

export function getAvatarUrl(metadata: ProfileMetadata): string | null {
  return metadata.avatar_url || metadata.picture || null;
}

export function getHeadline(metadata: ProfileMetadata): string {
  return metadata.headline?.trim() || '';
}

export function getUsername(metadata: ProfileMetadata): string {
  return metadata.username?.trim() || '';
}

export function profileValuesFromUser(
  user: AuthUser | null | undefined
): ProfileValues {
  const metadata = getProfileMetadata(user);
  return {
    displayName: getDisplayName(metadata, ''),
    username: getUsername(metadata),
    headline: getHeadline(metadata),
    avatarUrl: getAvatarUrl(metadata) || '',
  };
}

/**
 * Converts a Supabase auth user into the app's User shape.
 * Profile data lives in auth metadata so it works even before a public.users
 * row has been created (common for OAuth sign-ups).
 */
export function userFromAuthUser(authUser: AuthUser): User {
  const metadata = getProfileMetadata(authUser);
  const displayName = getDisplayName(metadata, '');
  const username = getUsername(metadata);

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    username: username || null,
    display_name: displayName || username || null,
    avatar_url: getAvatarUrl(metadata),
    is_global_admin: Boolean(metadata.is_global_admin),
    fcm_token: null,
    created_at: authUser.created_at,
    updated_at: new Date().toISOString(),
  };
}
