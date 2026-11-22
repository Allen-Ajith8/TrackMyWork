import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerAuthUser } from '@/lib/dashboard-data';
import { isSupabaseConfiguredForData } from '@/lib/supabase-config';
import { answerMica } from '@/lib/mica';
import type { RoomArtifactReference } from '@/lib/room-artifacts-context';

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
  ai_meta?: {
    referencedArtifacts?: RoomArtifactReference[];
    usedFallback?: boolean;
    hasRulebook?: boolean;
  };
}

// In-memory chat storage fallback for offline / demo mode
const inMemoryChatStore: Record<string, ChatMessage[]> = {};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const roomId = params.id;

  if (!isSupabaseConfiguredForData()) {
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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in.' }, { status: 401 });
    }

    const anyUser = user as any;

    const userName = body?.user_name || anyUser?.display_name || anyUser?.username || anyUser?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Teammate';
    const userRole = body?.user_role || 'Frontend';
    const isAnnouncement = Boolean(body?.is_announcement);

    // `/mica ...` is handled by the same grounded MICA service used by the
    // dedicated MICA endpoint, so the chat route never sends a raw slash
    // command to teammates.
    if (/^\/(mica|askmica)\b/i.test(content)) {
      const question = content.replace(/^\/(mica|askmica)\b/i, '').trim();
      const answer = await answerMica({
        roomId,
        message: question || 'Summarize the room rules, artifacts and current project state.',
        history: (inMemoryChatStore[roomId] || [])
          .slice(-10)
          .filter((message) => message.user_id !== 'mica-agent')
          .map((message) => ({
            role: message.user_id === user?.id ? ('user' as const) : ('assistant' as const),
            content: `${message.user_name}: ${message.content}`,
          })),
        userId: user?.id,
        userName,
      });

      const micaMessage: ChatMessage = {
        id: `mica-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        room_id: roomId,
        user_id: 'mica-agent',
        user_name: 'MICA',
        user_avatar: null,
        user_role: 'AI Assistant',
        content: answer.reply,
        is_announcement: false,
        created_at: new Date().toISOString(),
        ai_meta: {
          referencedArtifacts: answer.referencedArtifacts,
          usedFallback: answer.usedFallback,
          hasRulebook: answer.hasRulebook,
        },
      };

      if (!inMemoryChatStore[roomId]) inMemoryChatStore[roomId] = [];
      inMemoryChatStore[roomId].push(micaMessage);
      if (inMemoryChatStore[roomId].length > 200) {
        inMemoryChatStore[roomId] = inMemoryChatStore[roomId].slice(-200);
      }

      if (isSupabaseConfiguredForData()) {
        try {
          const admin = createAdminClient();
          await admin.from('room_chat_messages').insert({
            id: micaMessage.id,
            room_id: roomId,
            user_id: micaMessage.user_id,
            user_name: micaMessage.user_name,
            user_avatar: micaMessage.user_avatar,
            user_role: micaMessage.user_role,
            content: micaMessage.content,
            is_announcement: false,
            created_at: micaMessage.created_at,
          });
        } catch {
          // Optional persistence.
        }
      }

      return NextResponse.json({
        success: true,
        message: micaMessage,
        mica: {
          referencedArtifacts: answer.referencedArtifacts,
          loadedArtifacts: answer.loadedArtifacts,
          usedArtifactCount: answer.referencedArtifacts.length,
          usedFallback: answer.usedFallback,
          hasRulebook: answer.hasRulebook,
        },
      });
    }

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      room_id: roomId,
      user_id: user.id,
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

    if (isSupabaseConfiguredForData()) {
      try {
        const admin = createAdminClient();
        // Ensure the user profile exists in public.users (FK safety for Magic Link / OTP users)
        await admin
          .from('users')
          .upsert(
            {
              id: user.id,
              email: user.email || '',
              username: (user as any)?.user_metadata?.username || (user as any)?.username || (user.email || '').split('@')[0] || 'user',
              display_name:
                (user as any)?.user_metadata?.display_name ||
                (user as any)?.user_metadata?.full_name ||
                (user as any)?.display_name ||
                (user.email || '').split('@')[0] ||
                'User',
              avatar_url: (user as any)?.user_metadata?.avatar_url || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );
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
