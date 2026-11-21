import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATH_PREFIXES = [
  '/_next',
  '/_next/static',
  '/_next/image',
  '/favicon.ico',
  '/api/courtroom',
  '/api/nexconn',
  '/api/nim',
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Skip static assets and public API routes entirely
  const pathname = req.nextUrl.pathname;
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return res;
  }

  try {
    const supabase = createMiddlewareClient({ req, res });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Dev mode bypass: check for dev user cookie FIRST, before Supabase session check
    const isDevMode = req.cookies.get('trackmywork_dev_user')?.value === 'true';

    // Protected page + API routes that require authentication
    const protectedPaths = ['/dashboard', '/room', '/settings', '/api/rooms', '/api/tasks'];
    const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

    // Auth routes (login, signup) - redirect to dashboard if already authenticated
    const authPaths = ['/auth/login', '/auth/signup', '/auth/callback'];
    const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

    const requireAuth =
      process.env.REQUIRE_AUTH === 'true' ||
      process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true';

    // Dev mode bypass: allow access without Supabase session
    if (isProtectedPath && !session && requireAuth && !isDevMode) {
      const redirectUrl = new URL('/auth/login', req.url);
      redirectUrl.searchParams.set('redirect', pathname + req.nextUrl.search);
      return NextResponse.redirect(redirectUrl);
    }

    if (isAuthPath && session) {
      const nextParam = req.nextUrl.searchParams.get('redirect') || '/dashboard';
      const destination = nextParam.startsWith('/') ? nextParam : '/dashboard';
      return NextResponse.redirect(new URL(destination, req.url));
    }
  } catch (err) {
    console.warn('[Middleware] Supabase session check error:', err);
    // If Supabase fails but we have dev mode cookie, allow access
    const isDevMode = req.cookies.get('trackmywork_dev_user')?.value === 'true';
    const protectedPaths = ['/dashboard', '/room', '/settings', '/api/rooms', '/api/tasks'];
    const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));
    const requireAuth =
      process.env.REQUIRE_AUTH === 'true' ||
      process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true';

    if (isProtectedPath && requireAuth) {
      const isDevModeFallback = req.cookies.get('trackmywork_dev_user')?.value === 'true';
      if (!isDevModeFallback) {
        const redirectUrl = new URL('/auth/login', req.url);
        redirectUrl.searchParams.set('redirect', pathname + req.nextUrl.search);
        return NextResponse.redirect(redirectUrl);
      }
    }
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
