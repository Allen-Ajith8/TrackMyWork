import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { nimClient } from '@/lib/nim/client';
import crypto from 'crypto';

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!;

interface DiscordInteraction {
  type: number;
  id: string;
  application_id: string;
  data?: {
    name: string;
    options?: { name: string; value: string; type: number }[];
  };
  guild_id?: string;
  channel_id: string;
  member?: {
    user: { id: string; username: string; global_name?: string };
    roles?: string[];
  };
  token: string;
  version: number;
}

interface DiscordResponse {
  type: number;
  data?: {
    content?: string;
    embeds?: DiscordEmbed[];
    flags?: number;
  };
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

const INTERACTION_TYPES = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
};

const RESPONSE_TYPES = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
};

function verifyDiscordSignature(req: NextRequest, body: string): boolean {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) return false;

  try {
    // Using Node.js crypto for Ed25519 verification
    // Note: In production, use a proper Ed25519 library like tweetnacl
    // This is a simplified verification for demonstration
    const message = timestamp + body;
    // Actual verification would use: nacl.sign.detached.verify(...)
    // For now, we'll do a basic check
    return true; // Replace with actual verification in production
  } catch {
    return false;
  }
}

function createEmbed(title: string, description: string, color: number = 0x9333ea, fields?: DiscordEmbed['fields']): DiscordEmbed {
  return {
    title,
    description,
    color,
    fields,
    footer: { text: 'TrackMyWork' },
    timestamp: new Date().toISOString(),
  };
}

async function sendFollowup(applicationId: string, token: string, data: { content?: string; embeds?: DiscordEmbed[] }) {
  try {
    await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Failed to send Discord followup:', error);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Verify Discord signature
  if (!verifyDiscordSignature(req, body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle PING
  if (interaction.type === INTERACTION_TYPES.PING) {
    return NextResponse.json({ type: RESPONSE_TYPES.PONG });
  }

  // Handle Application Commands
  if (interaction.type === INTERACTION_TYPES.APPLICATION_COMMAND) {
    const commandName = interaction.data?.name;

    switch (commandName) {
      case 'status':
        return handleStatusCommand(interaction);
      case 'ask-nim':
        return handleAskNimCommand(interaction);
      case 'room-info':
        return handleRoomInfoCommand(interaction);
      case 'my-tasks':
        return handleMyTasksCommand(interaction);
      default:
        return NextResponse.json({
          type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Unknown command', flags: 64 }, // ephemeral
        });
    }
  }

  return NextResponse.json({ type: RESPONSE_TYPES.PONG });
}

async function handleStatusCommand(interaction: DiscordInteraction): Promise<NextResponse> {
  const admin = createAdminClient();
  const userId = interaction.member?.user.id;
  const discordId = userId;

  // Find user by Discord ID (would need mapping in real implementation)
  // For now, use the Discord ID as a reference
  const { data: rooms } = await admin
    .from('room_members')
    .select('room_id, role_title, flag_is_team_leader, rooms(name, invite_code, project_type)')
    .eq('user_id', discordId)
    .eq('status', 'active')
    .limit(5);

  if (!rooms || rooms.length === 0) {
    return NextResponse.json({
      type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [
          createEmbed(
            '📭 No Active Rooms',
            'You are not a member of any active hackathon rooms.\nUse `/room-info` with a room invite code to check a specific room.',
            0xF59E0B
          ),
        ],
      },
    });
  }

  const fields = rooms.map(r => ({
    name: `${r.rooms.name} (${r.rooms.invite_code})`,
    value: `**Role:** ${r.role_title}${r.flag_is_team_leader ? ' 👑' : ''}\n**Type:** ${r.rooms.project_type}`,
    inline: true,
  }));

  return NextResponse.json({
    type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        createEmbed(
          '🏠 Your Hackathon Rooms',
          `Found **${rooms.length}** active room(s)`,
          0x9333EA,
          fields,
        ),
      ],
    },
  });
}

async function handleAskNimCommand(interaction: DiscordInteraction): Promise<NextResponse> {
  const question = interaction.data?.options?.find(o => o.name === 'question')?.value;
  const roomCode = interaction.data?.options?.find(o => o.name === 'room')?.value;
  const context = interaction.data?.options?.find(o => o.name === 'context')?.value as 'general' | 'code' | 'debug' | 'hardware' || 'general';

  if (!question) {
    return NextResponse.json({
      type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Please provide a question', flags: 64 },
    });
  }

  // Defer response (Discord requires response within 3 seconds)
  const deferredResponse: DiscordResponse = {
    type: RESPONSE_TYPES.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  };

  // Process in background and send followup
  processAskNim(interaction, question, roomCode, context);

  return NextResponse.json(deferredResponse);
}

async function processAskNim(
  interaction: DiscordInteraction,
  question: string,
  roomCode?: string,
  context: 'general' | 'code' | 'debug' | 'hardware' = 'general'
) {
  const admin = createAdminClient();
  let roomId: string | null = null;

  if (roomCode) {
    const { data: room } = await admin
      .from('rooms')
      .select('id')
      .eq('invite_code', roomCode)
      .single();
    roomId = room?.id || null;
  } else if (interaction.member?.user.id) {
    // Try to find user's primary room
    const { data: member } = await admin
      .from('room_members')
      .select('room_id')
      .eq('user_id', interaction.member!.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    roomId = member?.room_id || null;
  }

  let answer: string;
  let model = 'meta/llama-3.3-70b-instruct';

  try {
    if (context === 'debug' || context === 'code') {
      model = 'qwen/qwen2.5-coder-32b-instruct';
    } else if (context === 'hardware') {
      model = 'meta/llama-3.3-70b-instruct';
    }

    const systemPrompts: Record<string, string> = {
      general: 'You are a helpful hackathon assistant. Give concise, practical answers.',
      code: 'You are an expert software engineer. Provide code examples and best practices.',
      debug: 'You are a debugging expert. Analyze the issue and provide root cause + fix.',
      hardware: 'You are a hardware engineer. Provide component suggestions, wiring, and calculations.',
    };

    const nimResponse = await nimClient.callNimRaw(
      [
        { role: 'system', content: systemPrompts[context] },
        { role: 'user', content: `Context: ${context}${roomId ? ` (Room: ${roomId})` : ''}\n\nQuestion: ${question}` },
      ],
      model
    );

    answer = nimResponse.choices[0]?.message?.content || 'No answer generated';
  } catch (error) {
    answer = `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  // Send followup
  await sendFollowup(interaction.application_id, interaction.token, {
    embeds: [
      createEmbed(
        `🤖 NIM Answer (${context})`,
        answer,
        context === 'debug' ? 0xEF4444 : 0x9333EA,
        [
          { name: 'Question', value: question.slice(0, 1000), inline: false },
        ],
      ),
    ],
  });

  // Log to room if roomId found
  if (roomId) {
    await admin.from('nim_logs').insert({
      room_id: roomId,
      triggered_by: interaction.member?.user.id || 'discord_user',
      trigger_type: 'manual',
      model_used: model,
      input_text: question,
      output_text: answer,
      success: true,
    });
  }
}

async function handleRoomInfoCommand(interaction: DiscordInteraction): Promise<NextResponse> {
  const roomCode = interaction.data?.options?.find(o => o.name === 'code')?.value;

  if (!roomCode) {
    return NextResponse.json({
      type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Please provide a room invite code', flags: 64 },
    });
  }

  const admin = createAdminClient();
  const { data: room } = await admin
    .from('rooms')
    .select('*, room_members(*, users(*))')
    .eq('invite_code', roomCode)
    .single();

  if (!room) {
    return NextResponse.json({
      type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [
          createEmbed('❌ Room Not Found', `No room found with invite code: ${roomCode}`, 0xEF4444),
        ],
      },
    });
  }

  const activeMembers = room.room_members?.filter((m: { status: string }) => m.status === 'active') || [];
  const memberList = activeMembers.slice(0, 10).map((m: { role_title: string; flag_is_team_leader: boolean; users: { username?: string; display_name?: string } }) =>
    `${m.flag_is_team_leader ? '👑' : '👤'} **${m.users.display_name || m.users.username}** — ${m.role_title}`
  ).join('\n');

  return NextResponse.json({
    type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        createEmbed(
          `🏠 ${room.name}`,
          room.description || 'No description',
          0x9333EA,
          [
            { name: 'Invite Code', value: `\`${room.invite_code}\``, inline: true },
            { name: 'Type', value: room.project_type, inline: true },
            { name: 'Team Size', value: `${activeMembers.length}/${room.team_size}`, inline: true },
            { name: 'Members', value: memberList || 'None', inline: false },
            { name: 'GitHub', value: room.github_repo ? `[Repo](${room.github_repo})` : 'Not linked', inline: true },
            { name: 'Setup Complete', value: room.is_setup_complete ? '✅ Yes' : '❌ No', inline: true },
          ],
        ),
      ],
    },
  });
}

async function handleMyTasksCommand(interaction: DiscordInteraction): Promise<NextResponse> {
  const userId = interaction.member?.user.id;
  const roomCode = interaction.data?.options?.find(o => o.name === 'room')?.value;

  const admin = createAdminClient();
  let roomId: string | null = null;

  if (roomCode) {
    const { data: room } = await admin
      .from('rooms')
      .select('id')
      .eq('invite_code', roomCode)
      .single();
    roomId = room?.id || null;
  } else if (userId) {
    const { data: member } = await admin
      .from('room_members')
      .select('room_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    roomId = member?.room_id || null;
  }

  if (!roomId) {
    return NextResponse.json({
      type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Could not determine your room. Use `/my-tasks room:<code>`', flags: 64 },
    });
  }

  const { data: tasks } = await admin
    .from('tasks')
    .select('*')
    .eq('room_id', roomId)
    .eq('assigned_to', userId)
    .in('status', ['todo', 'in_progress', 'review'])
    .order('priority', { ascending: false })
    .limit(10);

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({
      type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [
          createEmbed('✅ No Active Tasks', 'You have no assigned tasks in this room.', 0x10B981),
        ],
      },
    });
  }

  const statusEmojis: Record<string, string> = {
    todo: '📋',
    in_progress: '🔨',
    review: '👀',
    done: '✅',
    blocked: '🚫',
  };

  const taskList = tasks.map((t: { title: string; status: string; category: string; priority: number; due_date?: string }) =>
    `${statusEmojis[t.status] || '📋'} **${t.title}** (${t.category}, Priority: ${t.priority})${t.due_date ? ` — Due: ${new Date(t.due_date).toLocaleDateString()}` : ''}`
  ).join('\n');

  return NextResponse.json({
    type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        createEmbed(
          `📋 Your Tasks (${tasks.length})`,
          taskList,
          0x9333EA,
        ),
      ],
    },
  });
}

// Add raw NIM call method for Discord
// This would be added to nimClient