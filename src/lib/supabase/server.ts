import {
  createServerComponentClient,
  createRouteHandlerClient,
} from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * Supabase client for Server Components (read-only cookies).
 */
export function createServerClientSupabase() {
  return createServerComponentClient({ cookies });
}

/**
 * Supabase client for Route Handlers / Server Actions.
 * Required when the session cookies must be written (e.g. OAuth code exchange).
 */
export function createRouteHandlerSupabase() {
  return createRouteHandlerClient({ cookies });
}
