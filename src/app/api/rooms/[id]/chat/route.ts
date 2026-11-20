import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerAuthUser, isSupabaseConfigured } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  user_role: string;
  content: string;
  is_announcement: boolean;
  created_at: string;
}

// In-memory chat storage fallback for offline / demo mode
const inMemoryChatStore: Record<string, ChatMessage[]> = {};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const roomId = params.id;

  if (!isSupabaseConfigured()) {
    const list = inMemoryChatStore[roomId] || [];
    return NextResponse.json({ messages: list });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('room_chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      // Table might not exist yet, fallback to in-memory
      const list = inMemoryChatStore[roomId] || [];
      return NextResponse.json({ messages: list });
    }

    return NextResponse.json({ messages: data || [] });
  } catch {
    const list = inMemoryChatStore[roomId] || [];
    return NextResponse.json({ messages: list });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;
    const body = await req.json().catch(() => ({}));
    const content = typeof body?.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }

    const supabase = createServerClientSupabase();
    const user = await getServerAuthUser(supabase);
    const anyUser = user as any;

    const userName = body?.user_name || anyUser?.display_name || anyUser?.username || anyUser?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Teammate';
    const userRole = body?.user_role || 'Frontend';
    const isAnnouncement = Boolean(body?.is_announcement);

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      room_id: roomId,
      user_id: user?.id || 'demo-dev-user-001',
      user_name: userName,
      user_avatar: anyUser?.avatar_url || anyUser?.user_metadata?.avatar_url || null,
      user_role: userRole,
      content,
      is_announcement: isAnnouncement,
      created_at: new Date().toISOString(),
    };

    if (!inMemoryChatStore[roomId]) {
      inMemoryChatStore[roomId] = [];
    }
    inMemoryChatStore[roomId].push(newMsg);

    // Keep max 200 in memory
    if (inMemoryChatStore[roomId].length > 200) {
      inMemoryChatStore[roomId] = inMemoryChatStore[roomId].slice(-200);
    }

    if (isSupabaseConfigured()) {
      try {
        const admin = createAdminClient();
        await admin.from('room_chat_messages').insert({
          id: newMsg.id,
          room_id: roomId,
          user_id: newMsg.user_id,
          user_name: newMsg.user_name,
          user_avatar: newMsg.user_avatar,
          user_role: newMsg.user_role,
          content: newMsg.content,
          is_announcement: newMsg.is_announcement,
          created_at: newMsg.created_at,
        });
      } catch {
        // Table fallback
      }
    }

    return NextResponse.json({ success: true, message: newMsg });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to post message.' },
      { status: 500 }
    );
  }
}
