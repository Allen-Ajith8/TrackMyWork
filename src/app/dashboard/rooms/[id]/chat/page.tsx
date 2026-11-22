import { createServerClientSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NexconnRoomChat } from '@/components/chat/nexconn-room-chat';
import { isNexconnConfigured } from '@/lib/nexconn/server';
import { toNexconnUserId } from '@/lib/nexconn/shared';

export default async function RoomChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClientSupabase();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/chat`);
  }

  const { data: roomData } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('id', id)
    .single();
  if (!roomData) {
    redirect('/dashboard/rooms');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, username, avatar_url')
    .eq('id', authUser.id)
    .maybeSingle();

  const displayName =
    profile?.display_name ||
    profile?.username ||
    authUser.email?.split('@')[0] ||
    'Teammate';
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <NexconnRoomChat
      roomId={roomData.id}
      roomName={roomData.name}
      currentUserId={toNexconnUserId(authUser.id)}
      currentUserName={displayName}
      currentUserAvatarUrl={avatarUrl}
      configured={isNexconnConfigured()}
    />
  );
}
