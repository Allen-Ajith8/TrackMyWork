import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClientSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(req.url);
    const topicId = searchParams.get('topicId');

    let query = supabase
      .from('dsa_user_progress')
      .select('*')
      .eq('user_id', user.id);

    if (topicId) {
      query = query.eq('topic_id', topicId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      problemId,
      topicId,
      difficulty,
      status,
      notes,
      independence,
      challengeFaced,
      confidence,
      preferredNext,
      aiFeedback,
    } = body;

    if (!problemId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServerClientSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const admin = createAdminClient();

      // Check existing progress to increment attempts
      const { data: existing } = await admin
        .from('dsa_user_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('problem_id', problemId)
        .single();

      const attempts = (existing?.attempts || 0) + 1;
      const solvedAt =
        status === 'solved'
          ? existing?.solved_at || new Date().toISOString()
          : existing?.solved_at;

      const { data, error } = await admin
        .from('dsa_user_progress')
        .upsert(
          {
            user_id: user.id,
            problem_id: problemId,
            topic_id: topicId,
            difficulty,
            status,
            attempts,
            notes: notes || existing?.notes || null,
            independence: independence || existing?.independence || null,
            challenge_faced: challengeFaced || existing?.challenge_faced || null,
            confidence: confidence || existing?.confidence || null,
            preferred_next: preferredNext || existing?.preferred_next || null,
            ai_feedback: aiFeedback || existing?.ai_feedback || null,
            last_attempted_at: new Date().toISOString(),
            solved_at: solvedAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,problem_id' }
        )
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: true, localOnly: true });
      }

      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: true, localOnly: true });
  } catch {
    return NextResponse.json({ success: true, localOnly: true });
  }
}
