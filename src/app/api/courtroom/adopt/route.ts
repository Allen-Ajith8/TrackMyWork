// ============================================================================
// TrackMyWork - AI Courtroom: Adopt Option
// Phase 4: POST /api/courtroom/adopt
// Closes the loop by creating tasks, syncing AGENTS.md rules, and finalizing
// the court session.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  COURTROOM_BOT_USER_ID,
  getNexconnChannelId,
} from '@/lib/nexconn/shared';
import {
  ensureCourtroomBotRegistered,
  isNexconnConfigured,
  sendNexconnGroupText,
} from '@/lib/nexconn/server';

export const dynamic = 'force-dynamic';

type AdoptBody = {
  sessionId: string;
  optionId: string;
};

const PRIORITY_MAP: Record<string, number> = {
  P0: 3,
  P1: 2,
  P2: 1,
};

export async function POST(req: NextRequest) {
  const supabase = createServerClientSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as AdoptBody | null;
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
  const optionId = typeof body?.optionId === 'string' ? body.optionId.trim() : '';

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
  }

  if (!optionId) {
    return NextResponse.json({ error: 'optionId is required.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch session and verify it's awaiting human choice
  const { data: session, error: sessionError } = await admin
    .from('court_sessions')
    .select('id, room_id, created_by, status, decision_options, motion')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Court session not found.' }, { status: 404 });
  }

  if (session.status !== 'awaiting_human_choice') {
    return NextResponse.json(
      { error: `Cannot adopt: court session is ${session.status} (awaiting_human_choice required).` },
      { status: 400 }
    );
  }

  // Verify room membership
  const [{ data: membership }, { data: profile }] = await Promise.all([
    admin
      .from('room_members')
      .select('status')
      .eq('room_id', session.room_id)
      .eq('user_id', authUser.id)
      .eq('status', 'active')
      .maybeSingle(),
    admin.from('users').select('is_global_admin').eq('id', authUser.id).maybeSingle(),
  ]);

  const isMember =
    membership?.status === 'active' ||
    session.created_by === authUser.id ||
    Boolean(profile?.is_global_admin);

  if (!isMember) {
    return NextResponse.json({ error: 'You do not have access to this room.' }, { status: 403 });
  }

  // Find the selected OptionCard
  const decisionOptions = (session.decision_options as Array<{
    id: string;
    title: string;
    recommended_for: string;
    generated_tasks: Array<{
      title: string;
      description: string;
      priority: 'P0' | 'P1' | 'P2';
      estimate: string;
    }>;
    agents_md_rules: string[];
  }> | null) ?? [];

  const selectedOption = decisionOptions.find((opt) => opt.id === optionId);

  if (!selectedOption) {
    return NextResponse.json({ error: 'Option not found in this session.' }, { status: 404 });
  }

  // 1. Create tasks from generated_tasks
  const tasksToInsert = selectedOption.generated_tasks.map((task) => ({
    room_id: session.room_id,
    created_by: authUser.id,
    title: task.title,
    description: task.description || null,
    status: 'todo' as const,
    category: 'code' as const,
    priority: PRIORITY_MAP[task.priority] ?? 1,
    related_asset_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data: createdTasks, error: tasksError } = await admin
    .from('tasks')
    .insert(tasksToInsert)
    .select('id, title, status, priority, created_at');

  if (tasksError) {
    return NextResponse.json({ error: 'Could not create tasks.' }, { status: 500 });
  }

  // 2. Persist agents_md_rules to room's AGENTS.md (room_rules.custom_agent_instructions)
  const { data: roomRules } = await admin
    .from('room_rules')
    .select('custom_agent_instructions')
    .eq('room_id', session.room_id)
    .maybeSingle();

  const existingInstructions = (roomRules?.custom_agent_instructions as string | null) ?? '';
  const newRulesBlock = `\n## Courtroom Adopted Rules\n${selectedOption.agents_md_rules.map((r) => `- ${r}`).join('\n')}\n`;
  const updatedInstructions = existingInstructions
    ? `${existingInstructions}\n${newRulesBlock}`
    : newRulesBlock;

  const { error: rulesError } = await admin
    .from('room_rules')
    .upsert({
      room_id: session.room_id,
      custom_agent_instructions: updatedInstructions,
      updated_at: new Date().toISOString(),
    })
    .select('id');

  if (rulesError) {
    console.error('[Courtroom] Failed to sync AGENTS.md rules:', rulesError);
    // Non-fatal: tasks were created and session will be marked adopted
  }

  // 3. Finalize session as adopted
  const { error: updateError } = await admin
    .from('court_sessions')
    .update({
      status: 'adopted',
      adopted_option_id: optionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (updateError) {
    return NextResponse.json({ error: 'Could not finalize court session.' }, { status: 500 });
  }

  // 4. Record final gavel entry
  const { data: existingTranscripts } = await admin
    .from('court_transcripts')
    .select('turn_index')
    .eq('session_id', sessionId)
    .order('turn_index', { ascending: false })
    .limit(1);

  const nextTurnIndex = (existingTranscripts?.[0]?.turn_index ?? -1) + 1;

  await admin.from('court_transcripts').insert({
    session_id: sessionId,
    phase: 'judge_gavel',
    speaker_role: 'Presiding Judge',
    model_id: 'judge:adopt',
    content: `✅ Option Adopted: ${selectedOption.title}. Created ${createdTasks.length} tasks and synced ${selectedOption.agents_md_rules.length} rules to AGENTS.md.`,
    citations: [],
    turn_index: nextTurnIndex,
  });

  // 5. Broadcast the adopted ruling into the room's Team Chat channel.
  // Non-fatal: a chat outage must never block task creation.
  if (isNexconnConfigured()) {
    try {
      await ensureCourtroomBotRegistered();

      const taskLines = createdTasks
        .map((task) => `• ${task.title}`)
        .join('\n');

      await sendNexconnGroupText({
        fromUserId: COURTROOM_BOT_USER_ID,
        channelId: getNexconnChannelId(session.room_id),
        text: [
          `⚖️ Court ruling adopted: ${selectedOption.title}`,
          '',
          `Created ${createdTasks.length} task${createdTasks.length === 1 ? '' : 's'}:`,
          taskLines,
          '',
          `Synced ${selectedOption.agents_md_rules.length} rule${
            selectedOption.agents_md_rules.length === 1 ? '' : 's'
          } to AGENTS.md.`,
        ].join('\n'),
      });
    } catch (error) {
      console.error('[Nexconn] Failed to broadcast adopted ruling:', error);
    }
  }

  return NextResponse.json({
    success: true,
    adoptedOption: {
      id: selectedOption.id,
      title: selectedOption.title,
      recommended_for: selectedOption.recommended_for,
    },
    tasksCreated: createdTasks.length,
    rulesSynced: selectedOption.agents_md_rules.length,
  });
}