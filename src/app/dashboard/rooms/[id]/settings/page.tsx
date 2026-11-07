import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { TeamManagementClient } from '@/components/team-management-client';
import { RoomRepoClient } from '@/components/room-repo-client';
import { loadRoomMembers } from '@/lib/room-relations';

async function getRoomData(roomId: string) {
  const supabase = createServerClientSupabase();

  // Get room
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    return { room: null, members: [] };
  }

  const members = await loadRoomMembers(supabase, roomId, { activeOnly: false });

  return {
    room,
    members,
  };
}

export default async function TeamManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, members } = await getRoomData(id);

  if (!room) {
    notFound();
  }

  // Check authentication
  const supabase = createServerClientSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/settings`);
  }

  // Check if user is member (RLS will enforce, but we can redirect early)
  const isMember = members.some((m: any) => m.user_id === user.id && m.status === 'active');
  if (!isMember && !(user as any).is_global_admin) {
    notFound();
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <RoomRepoClient room={room} />
      <div className="flex-1 overflow-y-auto p-6">
        <TeamManagementClient room={room} initialMembers={members} />
      </div>
    </div>
  );
}
