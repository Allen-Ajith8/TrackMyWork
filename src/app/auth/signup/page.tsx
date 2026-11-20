'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import { createSessionJWT } from '@/lib/jwt';
import { Zap, Sparkles, Check, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // OAuth modal state
  const [oauthModal, setOauthModal] = useState<'google' | 'github' | null>(null);
  const [oauthEmail, setOauthEmail] = useState('');
  const [oauthName, setOauthName] = useState('');
  const [oauthUsername, setOauthUsername] = useState('');

  const supabase = createClient();
  const supabaseReady = isSupabaseConfigured();

  function completeRegistration(userData: {
    id?: string;
    email: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
  }) {
    const userId = userData.id || `usr_${Date.now()}`;
    const cleanEmail = userData.email.trim();
    const cleanName = userData.display_name.trim() || cleanEmail.split('@')[0];
    const cleanUsername = (userData.username || cleanEmail.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');

    const jwtToken = createSessionJWT({
      id: userId,
      email: cleanEmail,
      display_name: cleanName,
    });

    const fullUser = {
      id: userId,
      email: cleanEmail,
      username: cleanUsername,
      display_name: cleanName,
      avatar_url: userData.avatar_url || null,
      is_global_admin: true,
      fcm_token: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    useAuthStore.getState().setUser(fullUser);
    useAuthStore.getState().setSession({
      access_token: jwtToken,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    });

    if (typeof document !== 'undefined') {
      document.cookie = `trackmywork_user=${encodeURIComponent(
        JSON.stringify(fullUser)
      )}; path=/; max-age=2592000; SameSite=Lax`;
    }

    router.push(redirect);
    router.refresh();
  }

  async function handleOAuthClick(provider: 'google' | 'github') {
    setError('');

    if (supabaseReady) {
      setLoading(true);
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.searchParams.set('next', redirect);

      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: callbackUrl.toString(),
            queryParams: provider === 'google' ? {
              access_type: 'offline',
              prompt: 'consent',
            } : undefined,
            scopes: provider === 'github' ? 'read:user user:email' : undefined,
          },
        });

        if (error) {
          setError(error.message);
          setLoading(false);
        } else if (data?.url) {
          window.location.href = data.url;
        }
      } catch (err: any) {
        setError(err?.message || `Failed to initialize ${provider} sign up.`);
        setLoading(false);
      }
      return;
    }

    // In local mode, open seamless account selection
    if (provider === 'google') {
      setOauthEmail('deebiga@gmail.com');
      setOauthName('Deebiga');
      setOauthUsername('deebiga');
    } else {
      setOauthEmail('deebiga@users.noreply.github.com');
      setOauthName('Deebiga');
      setOauthUsername('deebiga');
    }
    setOauthModal(provider);
  }

  function handleOAuthModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!oauthEmail.trim()) return;

    const isGoogle = oauthModal === 'google';
    const cleanUsername = (oauthUsername.trim() || oauthEmail.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');

    const avatarUrl = isGoogle
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(oauthName || 'User')}`
      : `https://github.com/${cleanUsername}.png`;

    completeRegistration({
      email: oauthEmail.trim(),
      display_name: oauthName.trim() || oauthEmail.split('@')[0],
      username: cleanUsername,
      avatar_url: avatarUrl,
    });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError('Username must be 3-20 characters (letters, numbers, underscore only).');
      return;
    }

    setLoading(true);

    if (!supabaseReady) {
      completeRegistration({
        email: email.trim(),
        display_name: fullName.trim() || email.split('@')[0],
        username: username.trim() || email.split('@')[0],
      });
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim() || email.split('@')[0],
            display_name: fullName.trim() || email.split('@')[0],
            full_name: fullName.trim() || email.split('@')[0],
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else if (data.user?.identities?.length === 0) {
        setError('This email is already registered. Please sign in instead.');
        setLoading(false);
      } else {
        router.push('/auth/login?message=Registration successful! Check your email to confirm your account.');
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Could not complete registration. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shadow-md">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-surface-900 tracking-tight">TrackMyWork</span>
          </Link>
        </div>

        {/* Card */}
        <div className="card p-8 bg-white shadow-xl border border-surface-200 rounded-2xl relative overflow-hidden">
          <h1 className="text-2xl font-bold text-surface-900 text-center mb-1">Create your account</h1>
          <p className="text-surface-600 text-center text-sm mb-6">
            Join the hackathon management ecosystem
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => handleOAuthClick('google')}
              disabled={loading}
              className="py-2.5 px-3 rounded-xl border border-surface-300 hover:border-surface-400 bg-white hover:bg-surface-50 font-medium text-sm text-surface-800 flex items-center justify-center gap-2.5 transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Google</span>
            </button>
            <button
              type="button"
              onClick={() => handleOAuthClick('github')}
              disabled={loading}
              className="py-2.5 px-3 rounded-xl border border-surface-300 hover:border-surface-400 bg-white hover:bg-surface-50 font-medium text-sm text-surface-800 flex items-center justify-center gap-2.5 transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.305-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-surface-500 font-medium">Or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-3.5">
            <div>
              <label htmlFor="fullName" className="label text-xs font-semibold text-surface-700">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input text-sm py-2"
                placeholder="Deebiga"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="username" className="label text-xs font-semibold text-surface-700">Username (optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">@</span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input pl-7 text-sm py-2"
                  placeholder="deebiga"
                  disabled={loading}
                  maxLength={20}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label text-xs font-semibold text-surface-700">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input text-sm py-2"
                placeholder="deebiga@example.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="label text-xs font-semibold text-surface-700">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input text-sm py-2"
                placeholder="•••••••• (min 8 chars)"
                required
                disabled={loading}
                minLength={8}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label text-xs font-semibold text-surface-700">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input text-sm py-2"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 font-semibold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-surface-500">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary-600 hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>

        {/* OAuth Dialog Modal */}
        {oauthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-surface-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {oauthModal === 'google' ? (
                    <div className="w-9 h-9 rounded-xl bg-white border border-surface-200 shadow-xs flex items-center justify-center">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-surface-900 text-white shadow-xs flex items-center justify-center">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.305-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-sm text-surface-900">
                      Sign up with {oauthModal === 'google' ? 'Google' : 'GitHub'}
                    </h3>
                    <p className="text-[11px] text-surface-500">Fast, secure JWT authentication</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOauthModal(null)}
                  className="w-7 h-7 rounded-lg hover:bg-surface-100 flex items-center justify-center text-surface-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Recommended Quick Account */}
              <div className="p-3 bg-purple-50/80 border border-purple-200/80 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                  Recommended Account
                </span>
                <button
                  type="button"
                  onClick={() =>
                    completeRegistration({
                      email: oauthEmail,
                      display_name: oauthName || 'Deebiga',
                      username: oauthUsername || 'deebiga',
                      avatar_url:
                        oauthModal === 'google'
                          ? 'https://api.dicebear.com/7.x/initials/svg?seed=Deebiga'
                          : 'https://github.com/deebiga.png',
                    })
                  }
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-purple-200 hover:border-purple-300 shadow-xs text-left cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      D
                    </div>
                    <div className="truncate">
                      <p className="font-semibold text-xs text-surface-900">Deebiga</p>
                      <p className="text-[11px] text-surface-500 truncate">{oauthEmail}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-purple-600 shrink-0">Register</span>
                </button>
              </div>

              {/* Or customize account */}
              <form onSubmit={handleOAuthModalSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-surface-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={oauthName}
                    onChange={(e) => setOauthName(e.target.value)}
                    className="input text-xs py-2"
                    placeholder="Your Name"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-surface-700 block mb-1">
                    {oauthModal === 'google' ? 'Google Email' : 'GitHub Email / Username'}
                  </label>
                  <input
                    type="email"
                    value={oauthEmail}
                    onChange={(e) => setOauthEmail(e.target.value)}
                    className="input text-xs py-2"
                    placeholder={oauthModal === 'google' ? 'you@gmail.com' : 'you@github.com'}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Account & Enter Workspace</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface-50">
          <div className="text-surface-600 text-sm">Loading sign up...</div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
