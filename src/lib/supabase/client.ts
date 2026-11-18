'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  if (url.includes('your-project-id') || anonKey === 'your-anon-key') return false;
  return true;
}

export function createClient() {
  return createClientComponentClient();
}
