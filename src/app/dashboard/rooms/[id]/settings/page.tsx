import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { TeamManagementClient } from '@/components/team-management-client';
import { RoomRepoClient } from '@/components/room-repo-client';
import { RoomDetailsClient } from '@/components/room-details-client';
import { loadRoomMembers } from '@/lib/room-relations';
import { getServerAuthUser, getFallbackDemoRoom, isAuthRequired } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

async function getRoomData(roomId: string) {
  const supabase = createServerClientSupabase();

  let room: any = null;
  let roomError: any = null;
  try {
    const res = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    room = res.data;
    roomError = res.error;
  } catch (err) {
    roomError = err;
  }

  if (roomError || !room) {
    if (!isAuthRequired() || roomId.startsWith('demo-')) {
      const demo = getFallbackDemoRoom(roomId);
      return { room: demo.room, members: demo.members };
    }
    return { room: null, members: [] };
  }

  try {
    const members = await loadRoomMembers(supabase, roomId, { activeOnly: false });
    return { room, members };
  } catch {
    if (!isAuthRequired()) {
      const demo = getFallbackDemoRoom(roomId);
      return { room: demo.room, members: demo.members };
    }
    return { room, members: [] };
  }
}

export default async function TeamManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { room, members } = await getRoomData(id);

  if (!room) {
    notFound();
  }

  // Check authentication
  const supabase = createServerClientSupabase();
  const user = await getServerAuthUser(supabase);
  
  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/settings`);
  }

  // Check if user is member (RLS will enforce, but we can redirect early)
  const isMember = members.some((m: any) => m.user_id === user.id && m.status === 'active');
  const isGlobalAdmin = Boolean((user as any).is_global_admin || user.user_metadata?.is_global_admin);

  if (!isMember && !isGlobalAdmin && isAuthRequired()) {
    notFound();
  }

  const currentMember = members.find(
    (m: any) => m.user_id === user.id && m.status === 'active'
  );
  const canManageRepo = Boolean(
    room.created_by === user.id ||
      currentMember?.flag_is_team_leader ||
      currentMember?.flag_can_edit_repo ||
      isGlobalAdmin ||
      !isAuthRequired()
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <RoomDetailsClient room={room} />
      <RoomRepoClient room={room} canManageRepo={canManageRepo} />
      <div className="flex-1 overflow-y-auto p-6">
        <TeamManagementClient room={room} initialMembers={members} />
      </div>
    </div>
  );
}
