import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { nimClient } from '@/lib/nim/client';

const QSTASH_CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY!;
const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY!;

async function verifyQStashSignature(req: NextRequest): Promise<boolean> {
  const signature = req.headers.get('upstash-signature');
  if (!signature) return false;

  const body = await req.text();
  
  // Verify with current and next key (for rotation)
  const crypto = await import('crypto');
  
  for (const key of [QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY]) {
    const hmac = crypto.createHmac('sha256', key);
    const digest = hmac.update(body).digest('base64');
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
      return true;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  // Verify QStash signature
  if (!(await verifyQStashSignature(req))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const admin = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    switch (action) {
      case 'deadline_check':
        await checkDeadlines(admin);
        break;
      case 'sync_google_sheets':
        await syncGoogleSheets(admin);
        break;
      case 'cleanup_heartbeats':
        await cleanupHeartbeats(admin);
        break;
      case 'cleanup_file_locks':
        await cleanupFileLocks(admin);
        break;
      case 'send_daily_digest':
        await sendDailyDigest(admin);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function checkDeadlines(admin: ReturnType<typeof createAdminClient>) {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find tasks due in 24 hours
  const { data: tasks } = await admin
    .from('tasks')
    .select('id, title, room_id, assigned_to, due_date')
    .lte('due_date', in24Hours.toISOString())
    .gt('due_date', now.toISOString())
    .in('status', ['todo', 'in_progress', 'review'])
    .not('assigned_to', 'is', null);

  if (!tasks) return;

  for (const task of tasks) {
    await admin.from('notifications').insert({
      user_id: task.assigned_to!,
      room_id: task.room_id,
      type: 'deadline',
      title: `Deadline approaching: ${task.title}`,
      content: { task_id: task.id, due_date: task.due_date },
      action_url: `/room/${task.room_id}/tasks/${task.id}`,
    });
  }
}

async function syncGoogleSheets(admin: ReturnType<typeof createAdminClient>) {
  // This would sync with the master Hackathon Tracker Google Sheet
  // Implementation depends on Google Sheets API setup
  console.log('Google Sheets sync triggered');
  
  // Example: Update hackathon deadlines from sheet
  // const { data: rooms } = await admin.from('rooms').select('id, hackathon_sheet_row_id').not('hackathon_sheet_row_id', 'is', null);
  // For each room, fetch row data and update deadlines
}

async function cleanupHeartbeats(admin: ReturnType<typeof createAdminClient>) {
  // Remove heartbeats older than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  await admin
    .from('vibe_heartbeats')
    .delete()
    .lt('last_heartbeat', fiveMinutesAgo);
}

async function cleanupFileLocks(admin: ReturnType<typeof createAdminClient>) {
  // Remove expired file locks
  const now = new Date().toISOString();
  
  await admin
    .from('file_locks')
    .delete()
    .lt('expires_at', now);
}

async function sendDailyDigest(admin: ReturnType<typeof createAdminClient>) {
  // Get all active users with unread notifications
  const { data: users } = await admin
    .from('users')
    .select('id, email, username')
    .not('id', 'in', `(SELECT user_id FROM notifications WHERE is_read = false AND created_at > NOW() - INTERVAL '24 hours')`);

  if (!users) return;

  for (const user of users) {
    const { data: notifications } = await admin
      .from('notifications')
      .select('*, rooms(name)')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (!notifications || notifications.length === 0) continue;

    // In production, send email via Resend/SendGrid
    console.log(`Daily digest for ${user.email}: ${notifications.length} notifications`);
  }
}

// Also support GET for simple cron-job.org compatibility
export async function GET(req: NextRequest) {
  // Simple secret check for cron-job.org
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  
  await Promise.all([
    checkDeadlines(admin),
    cleanupHeartbeats(admin),
    cleanupFileLocks(admin),
  ]);

  return NextResponse.json({ success: true });
}