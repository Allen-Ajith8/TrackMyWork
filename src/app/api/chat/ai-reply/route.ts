// ============================================================================
// TrackMyWork - Team Chat: MICA Reply
// POST /api/chat/ai-reply
// Verifies room access, asks MICA (the in-room AI agent) for a short reply
// using recent chat + saved AI summaries as context, then posts it into the
// room's Nexconn channel. Returns the posted text + message id so the caller
// can render the reply without waiting for the realtime echo.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { invokeCourtroomText } from '@/lib/courtroom/nimClient';
import {
  MICA_BOT_NAME,
  MICA_BOT_USER_ID,
  getNexconnChannelId,
} from '@/lib/nexconn/shared';
import {
  ensureMicaRegistered,
  isNexconnConfigured,
  sendNexconnGroupText,
} from '@/lib/nexconn/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MICA_MODEL = 'nvidia/nemotron-3.5-bolt-e4b';
const MAX_PROMPT_CHARS = 4000;
const MAX_TRANSCRIPT_MESSAGES = 20;
const MAX_TRANSCRIPT_CHARS = 8000;
const MAX_SUMMARIES = 20;
const MAX_SUMMARY_CHARS = 6000;

type RecentMessage = {
  senderName?: string;
  text?: string;
};

type SavedSummary = {
  source?: string;
  topic?: string | null;
  body?: string;
};

type AiReplyBody = {
  roomId?: string;
  prompt?: string;
  recentMessages?: RecentMessage[];
  summaries?: SavedSummary[];
};

function buildTranscript(messages: RecentMessage[]): string {
  const lines: string[] = [];
  let total = 0;

  for (const message of messages.slice(-MAX_TRANSCRIPT_MESSAGES)) {
    const name =
      typeof message?.senderName === 'string' && message.senderName.trim()
        ? message.senderName.trim().slice(0, 60)
        : 'Teammate';
    const text =
      typeof message?.text === 'string' ? message.text.trim() : '';

    if (!text) continue;

    const line = `${name}: ${text.slice(0, 1200)}`;
    if (total + line.length > MAX_TRANSCRIPT_CHARS) break;

    lines.push(line);
    total += line.length + 1;
  }

  return lines.join('\n');
}

function buildSummaries(summaries: SavedSummary[]): string {
  const blocks: string[] = [];
  let total = 0;

  for (const summary of summaries.slice(-MAX_SUMMARIES)) {
    const source =
      typeof summary?.source === 'string' && summary.source.trim()
        ? summary.source.trim().slice(0, 40)
        : 'Other';
    const topic =
      typeof summary?.topic === 'string' ? summary.topic.trim().slice(0, 120) : '';
    const body =
      typeof summary?.body === 'string' ? summary.body.trim() : '';

    if (!body) continue;

    const header = topic ? `[${source} — ${topic}]` : `[${source}]`;
    const block = `${header}\n${body.slice(0, 1500)}`;
    if (total + block.length > MAX_SUMMARY_CHARS) break;

    blocks.push(block);
    total += block.length + 2;
  }

  return blocks.join('\n\n');
}

export async function POST(req: NextRequest) {
  const supabase = createServerClientSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!isNexconnConfigured()) {
    return NextResponse.json(
      {
        error: 'Nexconn Chat is not configured.',
        code: 'NEXCONN_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as AiReplyBody | null;
  const roomId = typeof body?.roomId === 'string' ? body.roomId.trim() : '';
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const recentMessages = Array.isArray(body?.recentMessages)
    ? body.recentMessages
    : [];
  const summaries = Array.isArray(body?.summaries) ? body.summaries : [];

  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required.' }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required.' }, { status: 400 });
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      { error: `prompt must be at most ${MAX_PROMPT_CHARS} characters.` },
      { status: 400 }
    );
  }

  // Verify room access (same rule as /api/nexconn/token).
  const admin = createAdminClient();
  const [{ data: room }, { data: membership }, { data: profile }] =
    await Promise.all([
      admin.from('rooms').select('id, created_by').eq('id', roomId).maybeSingle(),
      admin
        .from('room_members')
        .select('status')
        .eq('room_id', roomId)
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .maybeSingle(),
      admin
        .from('users')
        .select('is_global_admin')
        .eq('id', authUser.id)
        .maybeSingle(),
    ]);

  const isMember =
    Boolean(room) &&
    (membership?.status === 'active' ||
      room?.created_by === authUser.id ||
      Boolean(profile?.is_global_admin));

  if (!isMember) {
    return NextResponse.json(
      { error: 'You do not have access to this room.' },
      { status: 403 }
    );
  }

  const transcript = buildTranscript(recentMessages);
  const summaryContext = buildSummaries(summaries);

  const systemPrompt = [
    `You are ${MICA_BOT_NAME}, the in-room AI agent for a project team chat.`,
    'Answer the latest /mica request directly and concisely (2-6 sentences, under 160 words).',
    'Use the recent thread and the saved AI summaries as background context, but do not repeat them verbatim.',
    'Be practical and specific. Use plain text only: no markdown headings, tables, or code fences.',
    'If the context is insufficient, say what is missing instead of inventing details.',
    'Do not prefix your answer with your name, and do not mention that you are a language model.',
  ].join(' ');

  const sections: string[] = [];

  if (summaryContext) {
    sections.push(`Saved AI summaries (shared room context):\n${summaryContext}`);
  }

  if (transcript) {
    sections.push(`Recent room messages:\n${transcript}`);
  }

  sections.push(`Request:\n${prompt}`);

  const userPrompt = sections.join('\n\n');

  let replyText: string;
  try {
    const result = await invokeCourtroomText({
      role: 'Clerk Router',
      modelOverride: MICA_MODEL,
      systemPrompt,
      userPrompt,
      maxTokens: 450,
      temperature: 0.4,
    });

    replyText = result.text.trim();
  } catch (error) {
    console.error('[MICA] NIM reply failed:', error);
    return NextResponse.json(
      { error: 'MICA could not generate a reply.' },
      { status: 502 }
    );
  }

  if (!replyText) {
    return NextResponse.json(
      { error: 'MICA returned an empty reply.' },
      { status: 502 }
    );
  }

  try {
    await ensureMicaRegistered();

    const { messageId } = await sendNexconnGroupText({
      fromUserId: MICA_BOT_USER_ID,
      channelId: getNexconnChannelId(roomId),
      text: replyText,
      pushContent: replyText,
    });

    return NextResponse.json({
      text: replyText,
      messageId,
      senderId: MICA_BOT_USER_ID,
      senderName: MICA_BOT_NAME,
      sentTime: Date.now(),
    });
  } catch (error) {
    console.error('[MICA] Could not post reply:', error);
    return NextResponse.json(
      { error: 'MICA could not post the reply to the room.' },
      { status: 502 }
    );
  }
}
