'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * True when real Supabase credentials are present. Auth pages use this to
 * decide between the live client and the offline demo experience.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return false;
  if (
    url.includes('your-project-id') ||
    url.includes('placeholder') ||
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

let supabaseClient: ReturnType<typeof createClientComponentClient> | null = null;

export function createClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackKey;
    supabaseClient = createClientComponentClient({
      supabaseUrl,
      supabaseKey,
    });
  }
  return supabaseClient;
}

