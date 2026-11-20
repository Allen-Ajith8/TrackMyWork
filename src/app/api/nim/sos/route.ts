import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY!;
const NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const DEEPSEEK_MODEL = process.env.NIM_MODEL_DEEPSEEK_R1 || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

interface SosRequest {
  room_id: string;
  error_log: string;
  context: 'android_logcat' | 'rust_compiler' | 'flutter_build' | 'general';
  relevant_files: string[];
  commit_sha?: string;
  branch?: string;
}

interface NimMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callNim(messages: NimMessage[], model: string = DEEPSEEK_MODEL) {
  const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NIM_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NIM API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function POST(req: NextRequest) {
  const supabase = createServerClientSupabase();
  const admin = createAdminClient();

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SosRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { room_id, error_log, context, relevant_files, commit_sha, branch } = body;

  if (!room_id || !error_log || !context) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify user is member of room
  const { data: member } = await admin
    .from('room_members')
    .select('id, flag_can_trigger_nim')
    .eq('room_id', room_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
  }

  if (!member.flag_can_trigger_nim) {
    return NextResponse.json({ error: 'Insufficient permissions to trigger NIM' }, { status: 403 });
  }

  const startTime = Date.now();

  try {
    // Build context-aware system prompt
    const systemPrompts: Record<string, string> = {
      android_logcat: `You are an expert Android developer debugging Logcat output. Analyze the error log and provide:
1. Root cause analysis
2. Specific fix with code changes
3. Gradle/build commands to run
4. Prevention tips`,
      rust_compiler: `You are an expert Rust developer debugging compiler errors. Analyze the error and provide:
1. Root cause (borrow checker, type mismatch, lifetime, etc.)
2. Minimal fix with code example
3. Cargo commands to verify
4. Best practices to avoid this`,
      flutter_build: `You are an expert Flutter developer debugging build errors. Analyze and provide:
1. Root cause (dependency, platform, syntax, etc.)
2. Fix with code changes
4. Flutter/pub commands to run
5. Prevention tips`,
      general: `You are an expert software engineer debugging an error. Provide:
1. Root cause analysis
2. Step-by-step fix
3. Commands to verify
4. Prevention tips`,
    };

    const systemPrompt = systemPrompts[context] || systemPrompts.general;

    const userPrompt = `Context: ${context}
${commit_sha ? `Commit: ${commit_sha}` : ''}
${branch ? `Branch: ${branch}` : ''}
${relevant_files.length > 0 ? `Relevant Files:\n${relevant_files.map(f => `- ${f}`).join('\n')}` : ''}

Error Log:
\`\`\`
${error_log}
\`\`\`

Provide a structured debugging response.`;

    const nimResponse = await callNim([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const analysis = nimResponse.choices[0]?.message?.content || 'No analysis generated';
    const promptTokens = nimResponse.usage?.prompt_tokens || 0;
    const completionTokens = nimResponse.usage?.completion_tokens || 0;
    const latencyMs = Date.now() - startTime;

    // Log the SOS request
    await admin.from('nim_logs').insert({
      room_id,
      triggered_by: user.id,
      trigger_type: 'sos',
      model_used: DEEPSEEK_MODEL,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      input_text: JSON.stringify({ context, error_log: error_log.slice(0, 5000), relevant_files }),
      output_text: analysis,
      success: true,
    });

    // Create notification for user
    await admin.from('notifications').insert({
      user_id: user.id,
      room_id,
      type: 'sos',
      title: `SOS Debug Complete: ${context.replace('_', ' ')}`,
      content: {
        context,
        analysis: analysis.slice(0, 500),
        commit_sha,
        relevant_files,
      },
      action_url: `/dashboard/rooms/${room_id}`,
    });

    return NextResponse.json({
      success: true,
      analysis,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
      latency_ms: latencyMs,
    });
  } catch (error) {
    console.error('SOS NIM error:', error);

    await admin.from('nim_logs').insert({
      room_id,
      triggered_by: user.id,
      trigger_type: 'sos',
      model_used: DEEPSEEK_MODEL,
      input_text: JSON.stringify({ context, error_log: error_log.slice(0, 5000), relevant_files }),
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to analyze error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}