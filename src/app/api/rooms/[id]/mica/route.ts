import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerAuthUser } from '@/lib/dashboard-data';
import { isSupabaseConfiguredForData } from '@/lib/supabase-config';
import { answerMica, type MicaHistoryMessage } from '@/lib/mica';
import { getRoomArtifactsContext } from '@/lib/room-artifacts-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface MicaRequestBody {
  message?: string;
  prompt?: string;
  content?: string;
  history?: MicaHistoryMessage[];
  user_name?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const roomId = params.id;
  const artifacts = await getRoomArtifactsContext(roomId);
  return NextResponse.json({
    success: true,
    roomId,
    artifacts: artifacts.artifacts,
    artifactCount: artifacts.artifacts.length,
    hasRulebook: artifacts.hasRulebook,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const roomId = params.id;

  try {
    const user = await getServerAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as MicaRequestBody;
    const message = String(body.message || body.prompt || body.content || '').trim();

    if (!message) {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }

    const answer = await answerMica({
      roomId,
      message,
      history: Array.isArray(body.history) ? body.history.slice(-12) : undefined,
      userId: user.id,
      userName: body.user_name,
    });

    // Persist MICA's reply so teammates see it on their next chat load. This is
    // best-effort: older deployments may not have the room_chat_messages table.
    if (isSupabaseConfiguredForData()) {
      try {
        const admin = createAdminClient();
        await admin.from('room_chat_messages').insert({
          id: `mica-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          room_id: roomId,
          user_id: user.id,
          user_name: 'MICA',
          user_avatar: null,
          user_role: 'AI Assistant',
          content: answer.reply,
          is_announcement: false,
          created_at: new Date().toISOString(),
        });
      } catch {
        // Chat persistence is optional; the client still renders the reply.
      }
    }

    return NextResponse.json({
      success: true,
      reply: answer.reply,
      message: answer.reply,
      referencedArtifacts: answer.referencedArtifacts,
      loadedArtifacts: answer.loadedArtifacts,
      usedArtifactCount: answer.referencedArtifacts.length,
      usedFallback: answer.usedFallback,
      hasRulebook: answer.hasRulebook,
    });
  } catch (error) {
    console.error('[api/rooms/[id]/mica] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'MICA could not answer right now.' },
      { status: 500 }
    );
  }
}
