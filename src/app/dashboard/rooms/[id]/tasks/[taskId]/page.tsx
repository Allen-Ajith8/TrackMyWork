import { notFound, redirect } from 'next/navigation';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { attachUser } from '@/lib/room-relations';
import { TaskDetailClient } from '@/components/task-detail-client';

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const supabase = createServerClientSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/tasks/${taskId}`);
  }

  const { data: room } = await supabase.from('rooms').select('*').eq('id', id).single();
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('room_id', id)
    .single();

  if (!room || !task) {
    notFound();
  }

  const { data: members } = await supabase
    .from('room_members')
    .select('user_id, role_title, custom_role_name')
    .eq('room_id', id)
    .eq('status', 'active');

  const membersWithUsers = await attachUser({
    supabase,
    rows: members || [],
    idField: 'user_id',
    as: 'user',
  });

  return (
    <TaskDetailClient
      room={{ id: room.id, name: room.name }}
      task={task}
      members={membersWithUsers.map((member) => ({
        userId: member.user_id,
        name:
          member.user?.display_name ||
          member.user?.username ||
          (member.user?.email || '').split('@')[0] ||
          'Member',
        role: member.custom_role_name || member.role_title || 'Member',
        avatarUrl: member.user?.avatar_url || null,
      }))}
    />
  );
}
