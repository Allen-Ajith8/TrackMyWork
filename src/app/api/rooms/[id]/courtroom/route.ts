import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerAuthUser } from '@/lib/dashboard-data';
import { isSupabaseConfiguredForData } from '@/lib/supabase-config';
import { runCourtroom } from '@/lib/courtroom';
import { getRoomArtifactsContext } from '@/lib/room-artifacts-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    const body = await request.json().catch(() => ({}));
    const topic = String(body?.topic || body?.motion || body?.question || '').trim();

    if (!topic) {
      return NextResponse.json({ error: 'A courtroom topic is required.' }, { status: 400 });
    }

    const result = await runCourtroom({
      roomId,
      topic,
      userId: user.id,
    });

    if (isSupabaseConfiguredForData()) {
      try {
        const admin = createAdminClient();
        await admin.from('nim_logs').insert({
          room_id: roomId,
          triggered_by: user.id,
          trigger_type: 'manual',
          model_used: process.env.NIM_MODEL_LLAMA_3_3_70B || 'meta/llama-3.3-70b-instruct',
          input_text: JSON.stringify({
            action: 'courtroom',
            topic,
            artifacts: result.artifacts.map((artifact) => ({
              id: artifact.id,
              title: artifact.title,
              isRulebook: artifact.isRulebook,
            })),
          }),
          output_text: JSON.stringify({
            verdict: result.verdict.verdict,
            score: result.verdict.score,
            turns: result.turns.map((turn) => ({
              agent: turn.agentName,
              content: turn.content.slice(0, 4_000),
            })),
          }),
          success: true,
        });
      } catch {
        // Courtroom audit logging is best-effort.
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      usedArtifactCount: result.artifacts.length,
    });
  } catch (error) {
    console.error('[api/rooms/[id]/courtroom] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'The Courtroom could not run.' },
      { status: 500 }
    );
  }
}
