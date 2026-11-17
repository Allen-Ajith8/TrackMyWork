'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AtSign,
  Camera,
  Check,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import {
  getDisplayName,
  sanitizeUsername,
  validateUsername,
  type ProfileMetadata,
} from '@/lib/profile';
import { formatDate } from '@/lib/utils';

interface ProfileClientProps {
  authUser: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    metadata: Record<string, unknown>;
  };
  initialProfile: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

type Status = { type: 'success' | 'error'; message: string } | null;

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

export function ProfileClient({ authUser, initialProfile }: ProfileClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const metadata = authUser.metadata as ProfileMetadata;

  const [displayName, setDisplayName] = useState(
    initialProfile?.display_name || getDisplayName(metadata, '')
  );
  const [username, setUsername] = useState(
    initialProfile?.username || metadata.username || ''
  );
  const [headline, setHeadline] = useState(metadata.headline || '');
  const [avatarUrl, setAvatarUrl] = useState(
    initialProfile?.avatar_url || metadata.avatar_url || metadata.picture || ''
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [usernameCheck, setUsernameCheck] = useState<{
    state: 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
    message: string;
  }>({ state: 'idle', message: '' });

  const savedUsername = initialProfile?.username || metadata.username || '';
  const cleanUsername = sanitizeUsername(username);

  // Live availability check (debounced) — mirrors the Instagram-style
  // "is this handle free?" feedback while typing.
  useEffect(() => {
    if (!cleanUsername) {
      setUsernameCheck({ state: 'idle', message: '' });
      return;
    }

    if (cleanUsername === savedUsername) {
      setUsernameCheck({ state: 'available', message: 'This is your current username.' });
      return;
    }

    const validationError = validateUsername(cleanUsername);
    if (validationError) {
      setUsernameCheck({ state: 'invalid', message: validationError });
      return;
    }

    setUsernameCheck({ state: 'checking', message: 'Checking availability…' });

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/profile/username?username=${encodeURIComponent(cleanUsername)}`,
          { cache: 'no-store' }
        );
        const payload = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (payload.available) {
          setUsernameCheck({
            state: 'available',
            message: `@${cleanUsername} is available.`,
          });
        } else {
          setUsernameCheck({
            state: 'taken',
            message: payload.reason || 'That username is already taken.',
          });
        }
      } catch {
        if (!cancelled) {
          setUsernameCheck({
            state: 'idle',
            message: 'Could not check availability. It will be verified when you save.',
          });
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cleanUsername, savedUsername]);

  const previewName = displayName.trim() || getDisplayName(metadata, 'Member');
  const previewUsername = username ? `@${username}` : null;
  const previewAvatar = removeAvatar ? '' : avatarUrl;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatus({ type: 'error', message: 'Please choose an image file.' });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setStatus({ type: 'error', message: 'Avatar must be smaller than 3 MB.' });
      return;
    }

    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarUrl(URL.createObjectURL(file));
    setStatus(null);
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setAvatarUrl('');
    setRemoveAvatar(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadAvatar(): Promise<string | null> {
    if (!avatarFile) return removeAvatar ? null : avatarUrl || null;

    const extension = avatarFile.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${authUser.id}/avatar-${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from('avatars').upload(path, avatarFile, {
      cacheControl: '3600',
      contentType: avatarFile.type,
      upsert: true,
    });

    if (error) {
      throw new Error(`Avatar upload failed: ${error.message}`);
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (displayName.trim().length < 2) {
      setStatus({ type: 'error', message: 'Display name must be at least 2 characters.' });
      return;
    }

    const usernameError = validateUsername(cleanUsername);
    if (usernameError) {
      setUsernameCheck({ state: 'invalid', message: usernameError });
      setStatus({ type: 'error', message: usernameError });
      return;
    }

    setSaving(true);

    try {
      // Re-check right before writing so a handle taken while typing is caught.
      if (cleanUsername && cleanUsername !== savedUsername) {
        setUsernameCheck({ state: 'checking', message: 'Checking availability…' });
        const response = await fetch(
          `/api/profile/username?username=${encodeURIComponent(cleanUsername)}`,
          { cache: 'no-store' }
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.available) {
          const reason = payload.reason || 'That username is already taken.';
          setUsernameCheck({ state: 'taken', message: reason });
          throw new Error(reason);
        }

        setUsernameCheck({
          state: 'available',
          message: `@${cleanUsername} is available.`,
        });
      }

      const uploadedAvatar = await uploadAvatar();
      const nextAvatar = removeAvatar ? null : uploadedAvatar;

      // Write the profile row first: its UNIQUE(username) constraint is the
      // final guard against two people claiming the same handle at once.
      const profileFields = {
        display_name: displayName.trim(),
        username: cleanUsername || null,
        avatar_url: nextAvatar,
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update(profileFields)
        .eq('id', authUser.id)
        .select('id');

      if (updateError) {
        if (updateError.code === '23505') {
          const message = 'That username was just taken. Please choose another.';
          setUsernameCheck({ state: 'taken', message });
          throw new Error(message);
        }
        throw new Error(updateError.message);
      }

      if (!updated || updated.length === 0) {
        const { error: insertError } = await supabase.from('users').insert({
          id: authUser.id,
          email: authUser.email,
          ...profileFields,
        });

        if (insertError) {
          if (insertError.code === '23505') {
            const message = 'That username was just taken. Please choose another.';
            setUsernameCheck({ state: 'taken', message });
            throw new Error(message);
          }
          throw new Error(insertError.message);
        }
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim(),
          username: cleanUsername || null,
          headline: headline.trim(),
          avatar_url: nextAvatar,
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (user) {
        setUser({
          ...user,
          display_name: displayName.trim(),
          username: cleanUsername || null,
          avatar_url: nextAvatar,
          updated_at: new Date().toISOString(),
        });
      }

      setAvatarFile(null);
      setAvatarUrl(nextAvatar || '');
      setRemoveAvatar(false);
      setStatus({ type: 'success', message: 'Profile updated successfully.' });
      router.refresh();
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Could not save your profile.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Your profile</h1>
          <p className="text-surface-600 mt-1">
            This is how teammates see you. Your email stays private.
          </p>
        </div>
        <Link href="/dashboard/settings" className="btn-outline">
          Account settings
        </Link>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <form onSubmit={handleSubmit} className="card p-6 space-y-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-primary-100 overflow-hidden flex items-center justify-center ring-4 ring-white shadow-md">
                {previewAvatar ? (
                  <img
                    src={previewAvatar}
                    alt="Profile avatar preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-3xl font-bold text-primary-700">
                    {previewName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-lg hover:bg-primary-700 transition-colors"
                aria-label="Upload avatar"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-outline text-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4" />
                  Change avatar
                </button>
                {previewAvatar && (
                  <button
                    type="button"
                    className="btn-ghost text-sm text-red-600 hover:bg-red-50"
                    onClick={handleRemoveAvatar}
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-surface-500">PNG, JPG or WebP. Up to 3 MB.</p>
            </div>
          </div>

          <div className="h-px bg-surface-200" />

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="displayName" className="label">
                Display name
              </label>
              <input
                id="displayName"
                className="input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="e.g. Allen Ajith"
                maxLength={60}
                required
              />
            </div>

            <div>
              <label htmlFor="username" className="label">
                Username
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  id="username"
                  className="input pl-9"
                  value={username}
                  onChange={(event) => setUsername(sanitizeUsername(event.target.value))}
                  placeholder="allen"
                  maxLength={20}
                />
              </div>
              <p className="text-xs text-surface-500 mt-1">Letters, numbers and underscores.</p>
              {usernameCheck.state === 'checking' && (
                <p className="text-xs text-surface-400 mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {usernameCheck.message}
                </p>
              )}
              {usernameCheck.state === 'available' && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {usernameCheck.message}
                </p>
              )}
              {usernameCheck.state === 'taken' && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  {usernameCheck.message}
                </p>
              )}
              {usernameCheck.state === 'invalid' && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  {usernameCheck.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="headline" className="label">
              Headline
            </label>
            <input
              id="headline"
              className="input"
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder="e.g. Full-stack developer · Hardware tinkerer"
              maxLength={80}
            />
            <p className="text-xs text-surface-500 mt-1">
              A short line shown under your name in team views.
            </p>
          </div>

          <div>
            <label htmlFor="avatarUrl" className="label">
              Avatar image URL
            </label>
            <input
              id="avatarUrl"
              className="input"
              value={removeAvatar ? '' : avatarUrl}
              onChange={(event) => {
                setAvatarFile(null);
                setRemoveAvatar(false);
                setAvatarUrl(event.target.value);
              }}
              placeholder="https://… (optional if you upload a file)"
            />
          </div>

          <div className="rounded-xl bg-surface-50 border border-surface-200 p-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-surface-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-surface-800">Email address</p>
                <p className="text-sm text-surface-600 break-all">{authUser.email}</p>
                <p className="text-xs text-surface-500 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Private — never shown in the sidebar or to teammates.
                </p>
              </div>
            </div>
          </div>

          {status && (
            <div
              className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
                status.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {status.type === 'success' && <Check className="w-4 h-4" />}
              {status.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Link href="/dashboard" className="btn-ghost">
              Cancel
            </Link>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="card p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-400 mb-4">
              Live preview
            </p>
            <div className="w-20 h-20 mx-auto rounded-full bg-primary-100 overflow-hidden flex items-center justify-center ring-4 ring-white shadow">
              {previewAvatar ? (
                <img
                  src={previewAvatar}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-2xl font-bold text-primary-700">
                  {previewName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <p className="mt-4 font-semibold text-surface-900">{previewName}</p>
            {previewUsername && <p className="text-sm text-primary-600">{previewUsername}</p>}
            <p className="text-sm text-surface-500 mt-2 min-h-[20px]">
              {headline.trim() || 'Your headline appears here'}
            </p>
          </div>

          <div className="card p-5 space-y-3 text-sm">
            <h3 className="font-semibold text-surface-900 flex items-center gap-2">
              <UserRound className="w-4 h-4 text-primary-600" />
              Account
            </h3>
            <div className="flex justify-between gap-3">
              <span className="text-surface-500">Member since</span>
              <span className="text-surface-800">{formatDate(authUser.created_at)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-surface-500">Last sign-in</span>
              <span className="text-surface-800">
                {authUser.last_sign_in_at ? formatDate(authUser.last_sign_in_at) : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-surface-500">Sign-in method</span>
              <span className="text-surface-800">Email / OAuth</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
