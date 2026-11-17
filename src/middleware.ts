import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protected routes that require authentication
  const protectedPaths = ['/dashboard', '/room', '/settings', '/api/rooms', '/api/tasks'];
  const isProtectedPath = protectedPaths.some((path) => req.nextUrl.pathname.startsWith(path));

  // Auth routes (login, signup) - redirect to dashboard if already authenticated
  const authPaths = ['/auth/login', '/auth/signup', '/auth/callback'];
  const isAuthPath = authPaths.some((path) => req.nextUrl.pathname.startsWith(path));

  if (isProtectedPath && !session) {
    // When demo developer mode is enabled (default), allow access without sign-in
    if (process.env.REQUIRE_AUTH === 'true') {
      const redirectUrl = new URL('/auth/login', req.url);
      redirectUrl.searchParams.set('redirect', req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isAuthPath && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/room/:path*',
    '/settings/:path*',
    '/api/rooms/:path*',
    '/api/tasks/:path*',
    '/api/bom/:path*',
    '/api/artifacts/:path*',
    '/api/integrations/:path*',
    '/auth/login',
    '/auth/signup',
    '/auth/callback',
  ],
};