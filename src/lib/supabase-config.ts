/**
 * Detects whether this deployment has a real, reachable Supabase project
 * configured. The repo ships placeholder values in `.env.local` for offline
 * demo mode, so checking for truthiness alone is not enough: a placeholder
 * project would make every query fail slowly instead of using demo data.
 */
export function isSupabaseConfiguredForData(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return false;
  if (url.includes('your-project-id') || url.includes('placeholder')) return false;
  if (key === 'your-anon-key' || key.endsWith('.placeholder')) return false;

  return true;
}
