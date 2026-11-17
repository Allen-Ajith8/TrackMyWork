import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeUsername, validateUsername } from '@/lib/profile';

export const dynamic = 'force-dynamic';

/**
 * Username availability check.
 *
 * Public on purpose: a handle is public information and the signup form needs
 * to check availability before an account exists. Signed-in users exclude
 * their own row so re-saving an unchanged username works.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('username') ?? '';
  const username = sanitizeUsername(raw);

  if (!username) {
    return NextResponse.json(
      { username, available: false, reason: 'Choose a username.' },
      { status: 400 }
    );
  }

  const validationError = validateUsername(username);
  if (validationError) {
    return NextResponse.json(
      { username, available: false, reason: validationError },
      { status: 400 }
    );
  }

  const supabase = createServerClientSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: existing, error } = await admin
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    console.error('Username lookup failed:', error);
    return NextResponse.json(
      { username, available: false, reason: 'Could not check availability right now.' },
      { status: 500 }
    );
  }

  const available = !existing || existing.id === user?.id;

  return NextResponse.json({
    username,
    available,
    reason: available ? null : 'That username is already taken.',
  });
}
