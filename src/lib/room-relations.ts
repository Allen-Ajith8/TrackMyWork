import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoomMember, User } from '@/types/database';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PostgREST cannot always resolve embedded relationships (for example when the
 * foreign key metadata is missing from the schema cache). Instead of relying on
 * `select('*, users(*)')` we fetch the related rows separately and merge them in
 * application code. This keeps every room page working regardless of the
 * database constraint state.
 */

export type RelatedUser = User;

type Row = Record<string, any>;

const USER_FIELDS = 'id, email, username, display_name, avatar_url';

function fallbackUser(id: string): RelatedUser {
  return {
    id,
    email: '',
    username: null,
    display_name: 'Member',
    avatar_url: null,
    is_global_admin: false,
    fcm_token: null,
    created_at: '',
    updated_at: '',
  };
}

export async function loadUsers(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>
): Promise<Map<string, RelatedUser>> {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  const map = new Map<string, RelatedUser>();

  if (unique.length === 0) {
    return map;
  }

  // The `users` table is protected by RLS that blocks authenticated reads in
  // the hosted project, so profile lookups use the service role on the server.
  // Only public profile columns are selected.
  const reader = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;

  const { data, error } = await reader
    .from('users')
    .select(USER_FIELDS)
    .in('id', unique);

  if (error || !data) {
    return map;
  }
  for (const user of data as unknown as RelatedUser[]) {
    map.set(user.id, user);
  }

  return map;
}

/**
 * Adds a related user object to every row, read from `idField` and stored under
 * `as`. Rows whose user record is missing still receive a placeholder object so
 * client components can safely read `row[as].display_name`.
 */
export async function attachUser<T, K extends string>(options: {
  supabase: SupabaseClient;
  rows: T[];
  idField: string;
  as: K;
}): Promise<Array<T & Record<K, RelatedUser>>> {
  const { supabase, rows, idField, as } = options;
  const users = await loadUsers(
    supabase,
    rows.map((row) => (row as Row)[idField] as string | null | undefined)
  );

  return rows.map((row) => {
    const id = (row as Row)[idField] as string | null | undefined;
    const user = id ? users.get(id) ?? fallbackUser(id) : fallbackUser('');
    return { ...(row as Row), [as]: user } as T & Record<K, RelatedUser>;
  });
}

export async function loadRoomMembers(
  supabase: SupabaseClient,
  roomId: string,
  options?: { activeOnly?: boolean }
): Promise<Array<RoomMember & { user: RelatedUser }>> {
  let query = supabase.from('room_members').select('*').eq('room_id', roomId);

  if (options?.activeOnly !== false) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error || !data) {
    return [];
  }

  return attachUser({
    supabase,
    rows: data as unknown as RoomMember[],
    idField: 'user_id',
    as: 'user',
  });
}
