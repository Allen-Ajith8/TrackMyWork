import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Dev-only authentication bypass.
 *
 * Only active when NODE_ENV === 'development'. Creates (or reuses) a dev user
 * and establishes a real Supabase session so the middleware and all client
 * queries work normally — no OAuth provider or email confirmation required.
 *
 * Never enable this in production.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev auth only available in development.' }, { status: 403 });
  }

  const searchParams = new URL(req.url).searchParams;
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const supabase = createRouteHandlerSupabase();
  const admin = createAdminClient();

  const DEV_EMAIL = 'dev@trackmywork.local';
  const DEV_PASSWORD = 'devpassword123';

  try {
    // 1. Ensure the dev user exists (skip email confirmation).
    const { data: existingUser, error: lookupError } = await admin.auth.admin.listUsers();
    const devUser = existingUser?.users?.find((u) => u.email === DEV_EMAIL);

    if (!devUser) {
      const { error: createError } = await admin.auth.admin.createUser({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'Dev User',
          username: 'devuser',
          display_name: 'Dev User',
          is_global_admin: true,
        },
      });
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
    }

    // 2. Sign in with the route handler client so session cookies are set.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });

    if (signInError) {
      return NextResponse.json({ error: signInError.message }, { status: 500 });
    }

    // 3. Redirect to the dashboard (or requested path).
    const redirectUrl = new URL(redirectTo, req.url);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dev login failed.' },
      { status: 500 }
    );
  }
}
