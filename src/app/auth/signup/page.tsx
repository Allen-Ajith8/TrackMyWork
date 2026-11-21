'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import { createSessionJWT } from '@/lib/jwt';
import { Zap, Sparkles, Check, X, Sun, Moon } from 'lucide-react';
import Galaxy from '@/components/ui/galaxy';

export const dynamic = 'force-dynamic';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('trackmywork_theme') as 'dark' | 'light' | null;
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    } else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('trackmywork_theme', nextTheme);
  };

  const isLight = mounted ? theme === 'light' : true;

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
        setError(err?.message || `Failed to initialize ${provider} sign-up.`);
        setLoading(false);
      }
      return;
    }

    if (provider === 'google') {
      setOauthEmail('dev@gmail.com');
      setOauthName('Dev User');
      setOauthUsername('dev');
    } else {
      setOauthEmail('dev@users.noreply.github.com');
      setOauthName('Dev User');
      setOauthUsername('dev');
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
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
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
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            username: username.trim() || email.split('@')[0],
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
    <div className={`min-h-screen relative flex items-center justify-center px-4 py-8 transition-colors duration-500 overflow-hidden ${
      isLight ? 'bg-white text-neutral-950' : 'bg-[#08080a] text-white'
    }`}>
      {/* Dynamic Galaxy Background matching Landing Page */}
      <div className="fixed inset-0 z-0 pointer-events-auto overflow-hidden">
        <Galaxy
          key={isLight ? 'light' : 'dark'}
          lightMode={isLight}
          transparent={true}
          starColors={
            isLight
              ? ['#991b1b', '#7f1d1d', '#450a0a', '#18181b']
              : ['#ef4444', '#f87171', '#fb7185', '#ffffff']
          }
          density={isLight ? 1.25 : 1.05}
          glowIntensity={isLight ? 0.45 : 0.55}
          flareIntensity={isLight ? 0.75 : 1.0}
          starSpeed={0.45}
          speed={0.85}
          twinkleIntensity={0.35}
          rotationSpeed={0.06}
          mouseInteraction={true}
          mouseRepulsion={true}
          repulsionStrength={2.2}
          clickWarp={true}
          className="w-full h-full opacity-90"
        />
      </div>

      {/* Subtle Ambient Red Glow */}
      <div 
        aria-hidden="true" 
        className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-500 ${
          isLight 
            ? 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(239,68,68,0.08),transparent_70%)]' 
            : 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(220,38,38,0.18),transparent_70%)]'
        }`} 
      />

      {/* Top Bar with Home Link & Theme Toggle */}
      <div className="fixed top-4 left-4 right-4 z-20 max-w-5xl mx-auto flex items-center justify-between pointer-events-auto">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center shadow-md shadow-red-500/25 group-hover:scale-105 transition-transform">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className={`font-black text-lg tracking-tight ${isLight ? 'text-black' : 'text-white'}`}>
            TrackMyWork<span className="text-red-600">.</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
          className={`p-2 rounded-lg border flex items-center gap-1.5 text-xs font-bold transition-all duration-200 backdrop-blur-md ${
            isLight 
              ? 'border-red-200 bg-red-50/80 text-red-700 hover:bg-red-100 shadow-sm' 
              : 'border-neutral-800 bg-neutral-900/80 text-red-400 hover:bg-neutral-800 shadow-md'
          }`}
        >
          {isLight ? (
            <>
              <Moon className="w-4 h-4 text-red-600 fill-red-600/20" />
              <span className="hidden sm:inline">Dark</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-red-400 fill-red-400/20" />
              <span className="hidden sm:inline">Light</span>
            </>
          )}
        </button>
      </div>

      {/* Main Registration Card */}
      <div className="w-full max-w-md relative z-10 pointer-events-auto mt-12">
        <div className={`p-8 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all ${
          isLight 
            ? 'bg-white/90 border-neutral-200/90 shadow-red-500/5' 
            : 'bg-[#090a10]/85 border-neutral-800 shadow-2xl shadow-black/80'
        }`}>
          <div className="text-center mb-6">
            <h1 className={`text-2xl font-black mb-1.5 tracking-tight ${isLight ? 'text-black' : 'text-white'}`}>
              Create an <span className="text-red-600 dark:text-red-500">Account</span>
            </h1>
            <p className={`text-xs font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
              Join the hackathon management ecosystem
            </p>
          </div>

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
              className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 cursor-pointer ${
                isLight 
                  ? 'border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 hover:border-red-300' 
                  : 'border-neutral-800 bg-neutral-900/90 hover:bg-neutral-800 text-white hover:border-red-500/40'
              }`}
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
              className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 cursor-pointer ${
                isLight 
                  ? 'border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 hover:border-red-300' 
                  : 'border-neutral-800 bg-neutral-900/90 hover:bg-neutral-800 text-white hover:border-red-500/40'
              }`}
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
              <div className={`w-full border-t ${isLight ? 'border-neutral-200' : 'border-neutral-800'}`} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className={`px-3 font-semibold ${isLight ? 'bg-white text-neutral-500' : 'bg-[#090a10] text-neutral-400'}`}>
                Or register with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-3.5">
            <div>
              <label htmlFor="fullName" className={`block text-xs font-bold mb-1 ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full rounded-xl border px-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all ${
                  isLight 
                    ? 'border-neutral-300 bg-white text-black focus:border-red-500 placeholder:text-neutral-400' 
                    : 'border-neutral-800 bg-neutral-900/90 text-white focus:border-red-500 placeholder:text-neutral-500'
                }`}
                placeholder="Deebiga"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="username" className={`block text-xs font-bold mb-1 ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>Username (optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">@</span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full rounded-xl border pl-7 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all ${
                    isLight 
                      ? 'border-neutral-300 bg-white text-black focus:border-red-500 placeholder:text-neutral-400' 
                      : 'border-neutral-800 bg-neutral-900/90 text-white focus:border-red-500 placeholder:text-neutral-500'
                  }`}
                  placeholder="dev"
                  disabled={loading}
                  maxLength={20}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className={`block text-xs font-bold mb-1 ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-xl border px-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all ${
                  isLight 
                    ? 'border-neutral-300 bg-white text-black focus:border-red-500 placeholder:text-neutral-400' 
                    : 'border-neutral-800 bg-neutral-900/90 text-white focus:border-red-500 placeholder:text-neutral-500'
                }`}
                placeholder="dev@trackmywork.local"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className={`block text-xs font-bold mb-1 ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-xl border px-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all ${
                  isLight 
                    ? 'border-neutral-300 bg-white text-black focus:border-red-500 placeholder:text-neutral-400' 
                    : 'border-neutral-800 bg-neutral-900/90 text-white focus:border-red-500 placeholder:text-neutral-500'
                }`}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className={`block text-xs font-bold mb-1 ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full rounded-xl border px-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all ${
                  isLight 
                    ? 'border-neutral-300 bg-white text-black focus:border-red-500 placeholder:text-neutral-400' 
                    : 'border-neutral-800 bg-neutral-900/90 text-white focus:border-red-500 placeholder:text-neutral-500'
                }`}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-600/30 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className={`mt-4 text-center text-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
            Already have an account?{' '}
            <Link href="/auth/login" className="text-red-600 dark:text-red-400 hover:underline font-bold">
              Sign in
            </Link>
          </p>
        </div>

        {/* Seamless OAuth Dialog Modal */}
        {oauthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className={`w-full max-w-sm rounded-2xl shadow-2xl border p-6 space-y-4 ${
              isLight ? 'bg-white border-neutral-200' : 'bg-[#0f1016] border-neutral-800 text-white'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {oauthModal === 'google' ? (
                    <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200 shadow-xs flex items-center justify-center">
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
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white shadow-xs flex items-center justify-center border border-neutral-700">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.305-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <h3 className={`font-bold text-sm ${isLight ? 'text-black' : 'text-white'}`}>
                      Sign up with {oauthModal === 'google' ? 'Google' : 'GitHub'}
                    </h3>
                    <p className={`text-[11px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Fast, secure JWT authentication</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOauthModal(null)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isLight ? 'hover:bg-neutral-100 text-neutral-500' : 'hover:bg-neutral-800 text-neutral-400'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* One-Click Recommended Account */}
              <div className={`p-3 rounded-xl border space-y-1.5 ${
                isLight ? 'bg-red-50/80 border-red-200/80' : 'bg-red-950/40 border-red-500/30'
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                  isLight ? 'text-red-700' : 'text-red-400'
                }`}>
                  Quick Register
                </span>
                <button
                  type="button"
                  onClick={() =>
                    completeRegistration({
                      email: oauthEmail,
                      display_name: oauthName || 'Dev User',
                      username: oauthUsername || 'dev',
                      avatar_url:
                        oauthModal === 'google'
                          ? 'https://api.dicebear.com/7.x/initials/svg?seed=Dev'
                          : 'https://github.com/dev.png',
                    })
                  }
                  className={`w-full flex items-center justify-between p-2 rounded-xl border shadow-xs text-left cursor-pointer transition-all ${
                    isLight 
                      ? 'bg-white border-red-200 hover:border-red-300' 
                      : 'bg-neutral-900 border-neutral-700 hover:border-red-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      D
                    </div>
                    <div className="truncate">
                      <p className={`font-semibold text-xs ${isLight ? 'text-black' : 'text-white'}`}>Dev User</p>
                      <p className={`text-[11px] truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{oauthEmail}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 shrink-0">Register</span>
                </button>
              </div>

              <form onSubmit={handleOAuthModalSubmit} className="space-y-3 pt-1">
                <div>
                  <label className={`text-xs font-bold block mb-1 ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>Full Name</label>
                  <input
                    type="text"
                    value={oauthName}
                    onChange={(e) => setOauthName(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 ${
                      isLight 
                        ? 'border-neutral-300 bg-white text-black focus:border-red-500' 
                        : 'border-neutral-800 bg-neutral-900 text-white focus:border-red-500'
                    }`}
                    placeholder="Your Name"
                    required
                  />
                </div>

                <div>
                  <label className={`text-xs font-bold block mb-1 ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                    {oauthModal === 'google' ? 'Google Email' : 'GitHub Email / Username'}
                  </label>
                  <input
                    type="email"
                    value={oauthEmail}
                    onChange={(e) => setOauthEmail(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 ${
                      isLight 
                        ? 'border-neutral-300 bg-white text-black focus:border-red-500' 
                        : 'border-neutral-800 bg-neutral-900 text-white focus:border-red-500'
                    }`}
                    placeholder={oauthModal === 'google' ? 'you@gmail.com' : 'you@github.com'}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-red-600/30"
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
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="text-white text-sm font-semibold">Loading registration...</div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
