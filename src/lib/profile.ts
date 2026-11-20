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
  const custom = (
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    (typeof metadata.user_name === 'string' ? metadata.user_name : '') ||
    (typeof metadata.preferred_username === 'string' ? metadata.preferred_username : '') ||
    metadata.username
  );
  return typeof custom === 'string' && custom.trim() ? custom.trim() : fallback;
}

export function getAvatarUrl(metadata: ProfileMetadata): string | null {
  const url = metadata.avatar_url || metadata.picture;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

export function getHeadline(metadata: ProfileMetadata): string {
  return typeof metadata.headline === 'string' ? metadata.headline.trim() : '';
}

export function getUsername(metadata: ProfileMetadata): string {
  const raw =
    metadata.username ||
    metadata.user_name ||
    metadata.preferred_username;
  return typeof raw === 'string' && raw.trim() ? sanitizeUsername(raw.trim()) : '';
}

export function profileValuesFromUser(
  user: AuthUser | null | undefined
): ProfileValues {
  const metadata = getProfileMetadata(user);
  const emailPrefix = user?.email ? user.email.split('@')[0] : '';
  return {
    displayName: getDisplayName(metadata, emailPrefix || 'Member'),
    username: getUsername(metadata) || sanitizeUsername(emailPrefix),
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
  const email = authUser.email ?? '';
  const emailPrefix = email ? email.split('@')[0] : '';
  const username = getUsername(metadata) || sanitizeUsername(emailPrefix);
  const displayName = getDisplayName(metadata, emailPrefix || 'Member');

  return {
    id: authUser.id,
    email,
    username: username || null,
    display_name: displayName,
    avatar_url: getAvatarUrl(metadata),
    is_global_admin: Boolean(metadata.is_global_admin),
    fcm_token: null,
    created_at: authUser.created_at,
    updated_at: new Date().toISOString(),
  };
}
