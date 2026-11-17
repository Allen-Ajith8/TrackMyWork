import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createServerClientSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        level: 'beginner',
        preferredDifficulty: 'Mixed Practice',
        streak: 1,
        last_active_date: new Date().toISOString().split('T')[0],
      });
    }

    const { data, error } = await supabase
      .from('dsa_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({
        userId: user.id,
        level: 'beginner',
        preferredDifficulty: 'Mixed Practice',
        streak: 1,
        last_active_date: new Date().toISOString().split('T')[0],
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      level: 'beginner',
      preferredDifficulty: 'Mixed Practice',
      streak: 1,
      last_active_date: new Date().toISOString().split('T')[0],
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { level, preferredDifficulty } = body;

    const supabase = createServerClientSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const admin = createAdminClient();
      await admin.from('dsa_profiles').upsert({
        user_id: user.id,
        ...(level && { level }),
        ...(preferredDifficulty && { preferred_difficulty: preferredDifficulty }),
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, level, preferredDifficulty });
  } catch {
    return NextResponse.json({ success: true });
  }
}
