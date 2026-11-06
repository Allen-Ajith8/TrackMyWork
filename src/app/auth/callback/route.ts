import { createRouteHandlerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const errorDescription =
    searchParams.get('error_description') || searchParams.get('error');

  // Only allow internal redirects (prevents open-redirect abuse).
  const requestedNext = searchParams.get('next') || '/dashboard';
  const next = requestedNext.startsWith('/') ? requestedNext : '/dashboard';

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorDescription)}`, origin)
    );
  }

  if (code) {
    const supabase = createRouteHandlerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, origin)
      );
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
