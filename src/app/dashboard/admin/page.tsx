import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Eye, Lock, ShieldCheck, Users } from 'lucide-react';
import { getDashboardContext } from '@/lib/dashboard-data';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { supabase, user } = await getDashboardContext();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/admin');
  }

  let isAdmin = Boolean(user.user_metadata?.is_global_admin);

  if (!isAdmin) {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('is_global_admin')
        .eq('id', user.id)
        .maybeSingle();
      isAdmin = Boolean(profile?.is_global_admin);
    } catch {
      // Fall back to auth metadata.
    }
  }

  if (!isAdmin) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-surface-400" />
        </div>
        <h1 className="text-xl font-bold text-surface-900 mt-5">Admin access required</h1>
        <p className="text-surface-500 mt-2">
          Ghost mode and global administration are limited to TrackMyWork global admins. If you
          believe you should have access, ask an administrator to enable it for your account.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const [roomsResult, usersResult, tasksResult] = await Promise.all([
    supabase.from('rooms').select('id, name, project_type, created_at, team_size').order('created_at', { ascending: false }).limit(100),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }),
  ]);

  const rooms = roomsResult.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <Eye className="w-6 h-6 text-purple-600" />
          Global admin
        </h1>
        <p className="text-surface-600 mt-1">
          Ghost mode overview of every room in the workspace.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-surface-500">Rooms</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{rooms.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-surface-500">Users</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{usersResult.count ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-surface-500">Tasks</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{tasksResult.count ?? '—'}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b border-surface-200 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold text-surface-900">All rooms</h2>
        </div>
        {rooms.length === 0 ? (
          <div className="p-10 text-center text-surface-500">No rooms found.</div>
        ) : (
          <div className="divide-y divide-surface-200">
            {rooms.map((room: any) => (
              <div key={room.id} className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-surface-900 truncate">{room.name}</p>
                  <p className="text-xs text-surface-500">
                    {room.project_type} · {room.team_size} seats · created{' '}
                    {formatDate(room.created_at)}
                  </p>
                </div>
                <Link
                  href={`/dashboard/rooms/${room.id}`}
                  className="btn-outline text-sm"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
