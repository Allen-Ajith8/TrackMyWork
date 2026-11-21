'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Zap, Mail, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';

type Step = 'email' | 'otp' | 'password' | 'success';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}

function ForgotPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const supabase = createClient();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/forgot-password`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setStep('otp');
      setMessage('OTP sent to your email. Check your inbox.');
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'recovery',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setStep('password');
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setStep('success');
      setLoading(false);
    }
  }

  function goBack() {
    setStep('email');
    setError('');
    setMessage('');
    setOtp('');
  }

  return (
    <Suspense fallback={null}>
      <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-2xl text-surface-900">TrackMyWork</span>
            </Link>
          </div>

          {/* Card */}
          <div className="card p-8">
            {step === 'email' && (
              <>
                <h1 className="text-2xl font-bold text-surface-900 text-center mb-2">Forgot password</h1>
                <p className="text-surface-600 text-center mb-8">
                  Enter your email and we&apos;ll send you an OTP code to reset your password
                </p>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="label">Email</label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input"
                      placeholder="you@team.com"
                      required
                      disabled={loading}
                    />
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-surface-600">
                  Remember your password?{' '}
                  <Link href="/auth/login" className="text-primary-600 hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              </>
            )}

            {step === 'otp' && (
              <>
                <h1 className="text-2xl font-bold text-surface-900 text-center mb-2">Enter OTP</h1>
                <p className="text-surface-600 text-center mb-8">
                  We sent a 6-digit code to <span className="font-medium">{email}</span>
                </p>

                {message && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm mb-6">
                    {message}
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-6">
                    {error}
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label htmlFor="otp" className="label">OTP Code</label>
                    <input
                      id="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="input"
                      placeholder="123456"
                      maxLength={6}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={loading}
                      className="btn-outline text-sm"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </button>
                    <button type="submit" disabled={loading} className="btn-primary py-3">
                      {loading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {step === 'password' && (
              <>
                <h1 className="text-2xl font-bold text-surface-900 text-center mb-2">Reset Password</h1>
                <p className="text-surface-600 text-center mb-8">
                  Enter your new password
                </p>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="password" className="label">New Password</label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input"
                      placeholder="••••••••"
                      required
                      minLength={8}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="label">Confirm Password</label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input"
                      placeholder="••••••••"
                      required
                      disabled={loading}
                    />
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              </>
            )}

            {step === 'success' && (
              <>
                <div className="flex justify-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-surface-900 text-center mb-2">Password Reset</h1>
                <p className="text-surface-600 text-center mb-8">
                  Your password has been reset successfully.
                </p>

                <button
                  onClick={() => router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`)}
                  className="btn-primary w-full py-3"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Suspense>
  );
}
