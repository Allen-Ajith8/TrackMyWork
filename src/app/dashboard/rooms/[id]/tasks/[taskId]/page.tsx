import { notFound, redirect } from 'next/navigation';
import { createServerClientSupabase } from '@/lib/supabase/server';
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
    .select('user_id, role_title, custom_role_name, users(*)')
    .eq('room_id', id)
    .eq('status', 'active');

  return (
    <TaskDetailClient
      room={{ id: room.id, name: room.name }}
      task={task}
      members={(members || []).map((member: any) => ({
        userId: member.user_id,
        name:
          member.users?.display_name ||
          member.users?.username ||
          (member.users?.email || '').split('@')[0] ||
          'Member',
        role: member.custom_role_name || member.role_title || 'Member',
        avatarUrl: member.users?.avatar_url || null,
      }))}
    />
  );
}
