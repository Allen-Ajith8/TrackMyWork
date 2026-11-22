import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATH_PREFIXES = [
  '/_next',
  '/_next/static',
  '/_next/image',
  '/favicon.ico',
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Skip static assets entirely.
  const pathname = req.nextUrl.pathname;
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return res;
  }

  const requireAuth =
    process.env.REQUIRE_AUTH === 'true' ||
    process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true';

  // Auth routes (login, signup) - redirect to dashboard if already authenticated
  const authPaths = ['/auth/login', '/auth/signup', '/auth/callback'];
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  // Only enforce auth when explicitly required via env var. Otherwise skip the
  // Supabase session check entirely (zero network latency on page loads).
  if (!requireAuth && !isAuthPath) {
    return res;
  }

  try {
    const supabase = createMiddlewareClient({ req, res });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Protected page paths that require authentication
    const protectedPaths = ['/dashboard', '/room', '/settings'];
    const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

    if (isProtectedPath && !session) {
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
    const protectedPaths = ['/dashboard', '/room', '/settings'];
    const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));
    if (isProtectedPath) {
      const redirectUrl = new URL('/auth/login', req.url);
      redirectUrl.searchParams.set('redirect', pathname + req.nextUrl.search);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/room/:path*',
    '/settings/:path*',
    '/auth/login',
    '/auth/signup',
    '/auth/callback',
  ],
};