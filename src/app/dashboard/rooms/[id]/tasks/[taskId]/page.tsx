import { notFound, redirect } from 'next/navigation';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { attachUser } from '@/lib/room-relations';
import { TaskDetailClient } from '@/components/task-detail-client';
import { getServerAuthUser, getFallbackDemoRoom, isAuthRequired } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);

  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/tasks/${taskId}`);
  }

  let room: any = null;
  let task: any = null;
  try {
    const roomRes = await supabase.from('rooms').select('*').eq('id', id).single();
    room = roomRes.data;

    const taskRes = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('room_id', id)
      .single();
    task = taskRes.data;
  } catch {}

  if (!room || !task) {
    if (!isAuthRequired() || id.startsWith('demo-')) {
      const demo = getFallbackDemoRoom(id);
      room = demo.room;
      task = demo.tasks.find((t) => t.id === taskId) || {
        id: taskId,
        room_id: id,
        title: 'Demo Sprint Task',
        description: 'Demo task details for testing without authentication.',
        status: 'in_progress',
        priority: 'high',
        category: 'code',
        assigned_to: user.id,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      return (
        <TaskDetailClient
          room={{ id: room.id, name: room.name }}
          task={task}
          members={demo.members.map((member) => ({
            userId: member.user_id,
            name: member.user.display_name || member.user.username || 'Member',
            role: member.role_title,
            avatarUrl: member.user.avatar_url,
          }))}
        />
      );
    }
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
