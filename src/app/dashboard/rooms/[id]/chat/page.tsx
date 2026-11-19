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
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/rooms/${id}/chat`);
  }

  const { data: room } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('id', id)
    .single();

  if (!room) {
    redirect('/dashboard/rooms');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, username, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name ||
    profile?.username ||
    user.email?.split('@')[0] ||
    'Teammate';

  return (
    <NexconnRoomChat
      roomId={room.id}
      roomName={room.name}
      currentUserId={toNexconnUserId(user.id)}
      currentUserName={displayName}
      currentUserAvatarUrl={profile?.avatar_url ?? null}
      configured={isNexconnConfigured()}
    />
  );
}
