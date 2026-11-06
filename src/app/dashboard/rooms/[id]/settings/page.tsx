import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { TeamManagementClient } from '@/components/team-management-client';

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

  // Get members with user info
  const { data: members } = await supabase
    .from('room_members')
    .select('*, users(*)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  return {
    room,
    members: members || [],
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
  const isMember = members.some(m => m.user_id === user.id && m.status === 'active');
  if (!isMember && !user.is_global_admin) {
    notFound();
  }

  return (
    <TeamManagementClient
      room={room}
      initialMembers={members}
    />
  );
}