import {
  createServerComponentClient,
  createRouteHandlerClient,
} from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.placeholder';

/**
 * Supabase client for Server Components (read-only cookies).
 */
export function createServerClientSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackKey;

  return createServerComponentClient({ cookies }, { supabaseUrl, supabaseKey });
}

/**
 * Supabase client for Route Handlers / Server Actions.
 * Required when the session cookies must be written (e.g. OAuth code exchange).
 */
export function createRouteHandlerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackKey;

  return createRouteHandlerClient({ cookies }, { supabaseUrl, supabaseKey });
}
