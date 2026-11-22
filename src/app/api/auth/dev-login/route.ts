// ============================================================================
// TrackMyWork - Dev Login API
// POST /api/auth/dev-login
// Creates (or reuses) a real Supabase Auth user with email dev@trackmywork.local
// and establishes a real Supabase session via cookies.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const DEV_EMAIL = 'dev@trackmywork.local';
const DEV_PASSWORD = process.env.DEV_LOGIN_PASSWORD || 'TrackMyWorkDev!2026';
const DEV_DISPLAY_NAME = 'Dev Admin';
const DEV_USERNAME = 'dev';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev login only available in development.' }, { status: 403 });
  }

  const searchParams = new URL(req.url).searchParams;
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const admin = createAdminClient();
  const routeSupabase = createRouteHandlerSupabase();

  try {
    // 1. Ensure the dev user exists in Supabase Auth (auto-confirmed).
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const devAuthUser = existingUsers?.users?.find((u) => u.email === DEV_EMAIL);

    if (!devAuthUser) {
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: DEV_DISPLAY_NAME,
          username: DEV_USERNAME,
          display_name: DEV_DISPLAY_NAME,
          is_global_admin: true,
        },
      });
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
    }

    // 2. Upsert the matching row in public.users with the real UUID.
    const { data: authUserList } = await admin.auth.admin.listUsers();
    const authUser = authUserList?.users?.find((u) => u.email === DEV_EMAIL);

    if (authUser) {
      const { error: upsertError } = await admin.from('users').upsert({
        id: authUser.id,
        email: DEV_EMAIL,
        display_name: DEV_DISPLAY_NAME,
        username: DEV_USERNAME,
        is_global_admin: true,
        avatar_url: null,
        created_at: authUser.created_at,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) {
        console.error('[Dev Login] Failed to upsert public.users:', upsertError);
        // Non-fatal - continue to sign in
      }
    }

    // 3. Sign in with the route handler client so session cookies are set on the response.
    const { data: signInData, error: signInError } = await routeSupabase.auth.signInWithPassword({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });

    if (signInError || !signInData.session) {
      return NextResponse.json({ error: signInError?.message || 'Sign in failed.' }, { status: 500 });
    }

    // 4. Clear the legacy dev cookie if present.
    const res = NextResponse.redirect(new URL(redirectTo, req.url));
    res.cookies.set('trackmywork_dev_user', '', { path: '/', maxAge: 0 });

    return res;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dev login failed.' },
      { status: 500 }
    );
  }
}