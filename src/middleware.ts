import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  try {
    const supabase = createMiddlewareClient({ req, res });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Protected page routes that require authentication
    const protectedPages = ['/dashboard', '/room', '/settings'];
    const isProtectedPage = protectedPages.some((path) => req.nextUrl.pathname.startsWith(path));

    // Auth routes (login, signup) - redirect to dashboard if already authenticated
    const authPaths = ['/auth/login', '/auth/signup'];
    const isAuthPath = authPaths.some((path) => req.nextUrl.pathname.startsWith(path));

    const requireAuth =
      process.env.REQUIRE_AUTH === 'true' ||
      process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true';

    if (isProtectedPage && !session && requireAuth) {
      const redirectUrl = new URL('/auth/login', req.url);
      redirectUrl.searchParams.set('redirect', req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(redirectUrl);
    }

    if (isAuthPath && session) {
      const nextParam = req.nextUrl.searchParams.get('redirect') || '/dashboard';
      const destination = nextParam.startsWith('/') ? nextParam : '/dashboard';
      return NextResponse.redirect(new URL(destination, req.url));
    }
  } catch (err) {
    console.warn('[Middleware] Supabase session check error:', err);
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
