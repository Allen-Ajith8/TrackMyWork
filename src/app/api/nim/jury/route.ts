import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY!;
const NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const LLAMA_MODEL = process.env.NIM_MODEL_LLAMA_3_3_70B || 'meta/llama-3.3-70b-instruct';

interface JuryRequest {
  room_id: string;
  action: 'align' | 'mock_qa' | 'scope_check';
}

async function callNim(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], model: string = LLAMA_MODEL) {
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
      temperature: 0.3,
      max_tokens: 1500,
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: JuryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { room_id, action } = body;

  if (!room_id || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify user is member
  const { data: member } = await admin
    .from('room_members')
    .select('id')
    .eq('room_id', room_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
  }

  try {
    // Fetch room data
    const { data: room } = await admin
      .from('rooms')
      .select('jury_expectations, project_type')
      .eq('id', room_id)
      .single();

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Fetch recent tasks and commits
    const { data: tasks } = await admin
      .from('tasks')
      .select('id, title, status, category, nim_summary, updated_at')
      .eq('room_id', room_id)
      .order('updated_at', { ascending: false })
      .limit(30);

    const { data: nimLogs } = await admin
      .from('nim_logs')
      .select('input_text, output_text, created_at, model_used')
      .eq('room_id', room_id)
      .eq('trigger_type', 'github_webhook')
      .order('created_at', { ascending: false })
      .limit(10);

    const completedTasks = tasks?.filter(t => t.status === 'done').map(t => t.title) || [];
    const pendingTasks = tasks?.filter(t => t.status !== 'done').map(t => t.title) || [];

    let result: unknown;

    switch (action) {
      case 'align': {
        // Jury Alignment Analysis
        const recentCommits = (nimLogs || []).map(log => {
          try {
            const input = JSON.parse(log.input_text);
            return {
              sha: input.commit_sha || 'unknown',
              message: input.message || 'No message',
              diff_summary: log.output_text?.slice(0, 200) || 'No diff',
            };
          } catch {
            return null;
          }
        }).filter(Boolean);

        const systemPrompt = `You are a hackathon jury evaluator. Analyze the project progress against the jury expectations.
Return ONLY valid JSON with this exact structure:
{
  "alignment_score": number (0-100),
  "feedback": "string - detailed feedback on alignment",
  "scope_creep": ["string"] - array of detected scope creep items,
  "strengths": ["string"] - what's going well,
  "risks": ["string"] - potential risks for jury presentation,
  "recommendations": ["string"] - actionable recommendations
}`;

        const userPrompt = `Jury Expectations:
${room.jury_expectations || 'Not specified'}

Project Type: ${room.project_type}

Recent Commits (last 10):
${recentCommits.map((c, i) => `${i + 1}. ${c?.sha?.slice(0, 7)}: ${c?.message} - ${c?.diff_summary}`).join('\n') || 'No recent commits'}

Completed Tasks: ${completedTasks.join(', ') || 'None'}
Pending Tasks: ${pendingTasks.join(', ') || 'None'}

Evaluate how well the current progress aligns with jury expectations. Detect scope creep.`;

        const nimResponse = await callNim([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        const content = nimResponse.choices[0]?.message?.content || '{}';
        try {
          result = JSON.parse(content);
        } catch {
          result = {
            alignment_score: 0,
            feedback: 'Failed to parse NIM response',
            scope_creep: [],
            strengths: [],
            risks: [],
            recommendations: [],
          };
        }
        break;
      }

      case 'mock_qa': {
        // Generate Mock Jury Q&A
        const systemPrompt = `You are a hackathon jury member. Generate 5 realistic Q&A pairs that the jury would ask based on the project.
Return ONLY valid JSON array:
[
  {"question": "string", "answer": "string", "category": "technical|product|business|team"},
  ...
]`;

        const userPrompt = `Jury Expectations:
${room.jury_expectations || 'Not specified'}

Project Type: ${room.project_type}

Completed: ${completedTasks.join(', ') || 'None'}
In Progress: ${pendingTasks.join(', ') || 'None'}

Generate 5 tough but fair jury questions with ideal answers.`;

        const nimResponse = await callNim([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        const content = nimResponse.choices[0]?.message?.content || '[]';
        try {
          result = JSON.parse(content);
        } catch {
          result = [];
        }
        break;
      }

      case 'scope_check': {
        // Scope Creep Detection
        const recentCommits = (nimLogs || []).map(log => {
          try {
            const input = JSON.parse(log.input_text);
            return input.message || '';
          } catch {
            return '';
          }
        }).filter(Boolean);

        const systemPrompt = `You are a scope creep detector. Compare recent commit messages against jury expectations.
Return ONLY valid JSON:
{
  "scope_creep_detected": boolean,
  "severity": "low|medium|high",
  "creep_items": [{"commit": "string", "reason": "string", "suggestion": "string"}],
  "within_scope": ["string"] - commits that align well
}`;

        const userPrompt = `Jury Expectations:
${room.jury_expectations || 'Not specified'}

Recent Commit Messages:
${recentCommits.map((c, i) => `${i + 1}. ${c}`).join('\n') || 'No commits'}

Detect any scope creep.`;

        const nimResponse = await callNim([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        const content = nimResponse.choices[0]?.message?.content || '{}';
        try {
          result = JSON.parse(content);
        } catch {
          result = {
            scope_creep_detected: false,
            severity: 'low',
            creep_items: [],
            within_scope: [],
          };
        }
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Log the jury request
    await admin.from('nim_logs').insert({
      room_id,
      triggered_by: user.id,
      trigger_type: 'manual',
      model_used: LLAMA_MODEL,
      input_text: JSON.stringify({ action, jury_expectations: room.jury_expectations }),
      output_text: JSON.stringify(result),
      success: true,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Jury NIM error:', error);

    await admin.from('nim_logs').insert({
      room_id,
      triggered_by: user.id,
      trigger_type: 'manual',
      model_used: LLAMA_MODEL,
      input_text: JSON.stringify({ action }),
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to analyze', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}