import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NexconnRoomChat } from '@/components/chat/nexconn-room-chat';
import { isNexconnConfigured } from '@/lib/nexconn/server';
import { toNexconnUserId } from '@/lib/nexconn/shared';
import { getFallbackDemoRoom, isSupabaseConfigured } from '@/lib/dashboard-data';
import { DEMO_DEVELOPER_USER } from '@/lib/constants';

export default async function RoomChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demoMode = !isSupabaseConfigured() || id.startsWith('demo-');

  let room: { id: string; name: string };
  let user: { id: string; display_name?: string | null; username?: string | null; email?: string | null; avatar_url?: string | null };
  let displayName: string;
  let avatarUrl: string | null;

  if (demoMode) {
    room = getFallbackDemoRoom(id).room;
    user = DEMO_DEVELOPER_USER;
    displayName = user.display_name ?? 'Developer';
    avatarUrl = user.avatar_url ?? null;
  } else {
    const supabase = createServerClientSupabase();

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      redirect(`/auth/login?redirect=/dashboard/rooms/${id}/chat`);
    }
    user = authUser;

    const { data: roomData } = await supabase
      .from('rooms')
      .select('id, name')
      .eq('id', id)
      .single();
    if (!roomData) {
      redirect('/dashboard/rooms');
    }
    room = roomData;

    const { data: profile } = await supabase
      .from('users')
      .select('display_name, username, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    displayName =
      profile?.display_name ||
      profile?.username ||
      user.email?.split('@')[0] ||
      'Teammate';
    avatarUrl = profile?.avatar_url ?? null;
  }

  return (
    <NexconnRoomChat
      roomId={room.id}
      roomName={room.name}
      currentUserId={toNexconnUserId(user.id)}
      currentUserName={displayName}
      currentUserAvatarUrl={avatarUrl}
      configured={isNexconnConfigured()}
    />
  );
}
