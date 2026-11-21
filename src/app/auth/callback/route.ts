import { createRouteHandlerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const errorDescription =
    searchParams.get('error_description') || searchParams.get('error');

  // Only allow internal redirects (prevents open-redirect abuse).
  const requestedNext = searchParams.get('next') || '/dashboard';
  const next = requestedNext.startsWith('/') ? requestedNext : '/dashboard';

  if (errorDescription) {
    console.warn('[Auth Callback] OAuth error returned from provider:', errorDescription);
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorDescription)}`, origin)
    );
  }

  if (code) {
    try {
      const supabase = createRouteHandlerSupabase();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('[Auth Callback] exchangeCodeForSession failed:', error.message);
        return NextResponse.redirect(
          new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, origin)
        );
      }

      // Guarantee the user profile is recorded in public.users
      if (data?.session?.user) {
        const authUser = data.session.user;
        const metadata = authUser.user_metadata || {};
        const email = authUser.email || '';
        const rawUsername =
          metadata.user_name ||
          metadata.preferred_username ||
          metadata.username ||
          (email ? email.split('@')[0] : `user_${authUser.id.slice(0, 8)}`);
        const username = String(rawUsername).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
        const displayName =
          metadata.full_name ||
          metadata.name ||
          metadata.display_name ||
          rawUsername;
        const avatarUrl = metadata.avatar_url || metadata.picture || null;

        try {
          const admin = createAdminClient();
          // Avoid username unique constraint collisions
          let resolvedUsername = username || null;
          if (resolvedUsername) {
            const { data: existingUser } = await admin
              .from('users')
              .select('id')
              .eq('username', resolvedUsername)
              .neq('id', authUser.id)
              .maybeSingle();

            if (existingUser) {
              resolvedUsername = `${resolvedUsername.slice(0, 14)}_${Math.floor(1000 + Math.random() * 9000)}`;
            }
          }

          await admin.from('users').upsert(
            {
              id: authUser.id,
              email,
              username: resolvedUsername,
              display_name: displayName,
              avatar_url: avatarUrl,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );
        } catch (dbErr: any) {
          console.warn('[Auth Callback] User profile sync warning:', dbErr?.message);
        }
      }
    } catch (err: any) {
      console.error('[Auth Callback] Unexpected error during code exchange:', err);
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(err?.message || 'Authentication failed')}`, origin)
      );
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
