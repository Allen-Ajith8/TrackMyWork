'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return false;
  if (
    url.includes('your-project-id') ||
    anonKey === 'your-anon-key' ||
    anonKey.length < 20
  ) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createClient() {
  return createClientComponentClient();
}
