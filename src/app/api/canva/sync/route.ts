import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { nimClient } from '@/lib/nim/client';
import crypto from 'crypto';

const CANVA_CLIENT_ID = process.env.CANVA_CLIENT_ID!;
const CANVA_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET!;
const CANVA_REDIRECT_URI = process.env.CANVA_REDIRECT_URI || 'http://localhost:3000/api/canva/callback';

interface CanvaDesign {
  id: string;
  title: string;
  thumbnail_url: string;
  created_at: string;
  updated_at: string;
  owner: { id: string; name: string };
}

interface CanvaPresentation {
  design_id: string;
  pages: { id: string; thumbnail_url: string; elements: CanvaElement[] }[];
}

interface CanvaElement {
  id: string;
  type: 'text' | 'image' | 'video' | 'shape' | 'line' | 'chart' | 'table';
  content?: string;
  style?: Record<string, unknown>;
  bounds?: { x: number; y: number; width: number; height: number };
}

export async function GET(req: NextRequest) {
  const supabase = createServerClientSupabase();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roomId = req.nextUrl.searchParams.get('room_id');
  if (!roomId) {
    return NextResponse.json({ error: 'room_id required' }, { status: 400 });
  }

  // Verify user is member
  const { data: member } = await admin
    .from('room_members')
    .select('id, flag_can_upload_assets')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!member || !member.flag_can_upload_assets) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    // Get room's Canva integration config
    const { data: roomIntegration } = await admin
      .from('room_integrations')
      .select('config')
      .eq('room_id', roomId)
      .eq('integration_name', 'canva')
      .single();

    const accessToken = roomIntegration?.config?.access_token;
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Canva not connected. Please authenticate first.',
        auth_url: `/api/canva/auth?room_id=${roomId}`,
      }, { status: 400 });
    }

    // Fetch designs from Canva
    const designsResponse = await fetch('https://api.canva.com/rest/v1/designs', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!designsResponse.ok) {
      const error = await designsResponse.text();
      throw new Error(`Canva API error: ${designsResponse.status} - ${error}`);
    }

    const { designs } = await designsResponse.json();

    // Filter for presentations and recent designs
    const presentationDesigns = (designs as CanvaDesign[])
      .filter(d => d.title.toLowerCase().includes('pitch') || d.title.toLowerCase().includes('presentation') || d.title.toLowerCase().includes('deck'))
      .slice(0, 10);

    // For each presentation, fetch details and generate summary
    const syncedArtifacts = [];

    for (const design of presentationDesigns) {
      // Check if already synced
      const { data: existing } = await admin
        .from('artifacts')
        .select('id')
        .eq('room_id', roomId)
        .eq('canva_design_id', design.id)
        .single();

      if (existing) continue;

      // Fetch design details
      const detailResponse = await fetch(`https://api.canva.com/rest/v1/designs/${design.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!detailResponse.ok) continue;

      const detail = await detailResponse.json();

      // Generate summary using NIM
      const summary = await generatePresentationSummary(detail, accessToken);

      // Create artifact record
      const { data: artifact } = await admin
        .from('artifacts')
        .insert({
          room_id: roomId,
          uploaded_by: user.id,
          name: design.title,
          type: 'presentation',
          file_url: design.thumbnail_url,
          mime_type: 'application/vnd.canva.presentation',
          tags: ['canva', 'presentation', 'auto-synced'],
          version: '1.0',
          is_final: false,
          canva_design_id: design.id,
        })
        .select()
        .single();

      if (artifact) {
        syncedArtifacts.push({
          id: artifact.id,
          name: artifact.name,
          thumbnail: design.thumbnail_url,
          summary,
          canva_url: `https://canva.com/design/${design.id}`,
        });

        // Notify Pitch/Media team
        await notifyPitchTeam(admin, roomId, artifact, summary);
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedArtifacts.length,
      artifacts: syncedArtifacts,
    });
  } catch (error) {
    console.error('Canva sync error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function generatePresentationSummary(design: CanvaPresentation, accessToken: string): Promise<string> {
  // Extract text content from slides
  const slideTexts = design.pages.map(page =>
    page.elements
      .filter(e => e.type === 'text' && e.content)
      .map(e => e.content)
      .join(' ')
  ).filter(Boolean).join('\n\n');

  if (!slideTexts.trim()) return 'Presentation synced from Canva (no text content extracted)';

  try {
    const response = await nimClient.callNimRaw([
      {
        role: 'system',
        content: 'Summarize this hackathon presentation content in 3-4 sentences for the team. Focus on key points, problem, solution, and ask.',
      },
      {
        role: 'user',
        content: slideTexts.slice(0, 8000),
      },
    ], 'nvidia/nemotron-3.5-lightning-30b-a3b', 0.3, 300);

    return response.choices[0]?.message?.content?.trim() || 'Summary generation failed';
  } catch {
    return 'Presentation synced from Canva';
  }
}

async function notifyPitchTeam(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  artifact: { id: string; name: string },
  summary: string
) {
  const { data: pitchMembers } = await admin
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('role_title', 'Pitch/Media')
    .eq('status', 'active');

  if (!pitchMembers) return;

  for (const member of pitchMembers) {
    await admin.from('notifications').insert({
      user_id: member.user_id,
      room_id: roomId,
      type: 'nim_alert',
      title: `New Presentation: ${artifact.name}`,
      content: { summary, artifact_id: artifact.id, source: 'canva' },
      action_url: `/dashboard/rooms/${roomId}/artifacts/${artifact.id}`,
    });
  }
}

// OAuth initiation
export async function POST(req: NextRequest) {
  const supabase = createServerClientSupabase();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { room_id, action } = body;

  if (!room_id) {
    return NextResponse.json({ error: 'room_id required' }, { status: 400 });
  }

  // Verify user is Team Leader or has can_edit_rules
  const { data: member } = await admin
    .from('room_members')
    .select('flag_is_team_leader, flag_can_edit_rules')
    .eq('room_id', room_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!member || (!member.flag_is_team_leader && !member.flag_can_edit_rules)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  if (action === 'connect') {
    // Generate Canva OAuth URL
    const scopes = 'design:read design:write design:meta:read';
    const state = crypto.randomBytes(16).toString('hex');

    // Store state for verification
    await admin.from('room_integrations').upsert({
      room_id,
      integration_name: 'canva_oauth_state',
      config: { state, user_id: user.id },
      is_active: true,
    }, { onConflict: 'room_id,integration_name' });

    const authUrl = `https://api.canva.com/rest/v1/oauth/authorize?` +
      new URLSearchParams({
        client_id: CANVA_CLIENT_ID,
        redirect_uri: CANVA_REDIRECT_URI,
        response_type: 'code',
        scope: scopes,
        state,
      }).toString();

    return NextResponse.json({ success: true, auth_url: authUrl });
  }

  if (action === 'disconnect') {
    await admin
      .from('room_integrations')
      .delete()
      .eq('room_id', room_id)
      .eq('integration_name', 'canva');

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// OAuth callback handler
export async function PUT(req: NextRequest) {
  const supabase = createServerClientSupabase();
  const admin = createAdminClient();

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard/rooms?error=canva_${error}`, req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/rooms?error=invalid_callback', req.url));
  }

  // Verify state
  const { data: storedState } = await admin
    .from('room_integrations')
    .select('config, room_id')
    .eq('integration_name', 'canva_oauth_state')
    .single();

  if (!storedState || storedState.config?.state !== state) {
    return NextResponse.redirect(new URL('/dashboard/rooms?error=invalid_state', req.url));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CANVA_CLIENT_ID,
        client_secret: CANVA_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: CANVA_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Token exchange failed');
    }

    const tokens = await tokenResponse.json();

    // Store tokens
    await admin.from('room_integrations').upsert({
      room_id: storedState.room_id,
      integration_name: 'canva',
      config: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        token_type: tokens.token_type,
      },
      is_active: true,
    }, { onConflict: 'room_id,integration_name' });

    // Clean up state
    await admin
      .from('room_integrations')
      .delete()
      .eq('room_id', storedState.room_id)
      .eq('integration_name', 'canva_oauth_state');

    return NextResponse.redirect(new URL(`/dashboard/rooms/${storedState.room_id}/artifacts?canva=connected`, req.url));
  } catch (err) {
    console.error('Canva OAuth error:', err);
    return NextResponse.redirect(new URL('/dashboard/rooms?error=canva_token_failed', req.url));
  }
}