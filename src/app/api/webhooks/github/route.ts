import { NextRequest, NextResponse } from 'next/server';
import { createServerClientSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { nimClient } from '@/lib/nim/client';
import type { GitHubWebhookPayload } from '@/types/database';
import crypto from 'crypto';

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET!;

function verifySignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

function parseDiff(diff: string): { added: string[]; modified: string[]; removed: string[]; summary: string } {
  const files = {
    added: [] as string[],
    modified: [] as string[],
    removed: [] as string[],
  };

  const lines = diff.split('\n');
  for (const line of lines) {
    if (line.startsWith('+++ b/')) files.added.push(line.slice(6));
    else if (line.startsWith('--- a/')) files.removed.push(line.slice(6));
    else if (line.startsWith('diff --git')) {
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      if (match && !files.modified.includes(match[2])) {
        files.modified.push(match[2]);
      }
    }
  }

  const summary = [
    files.added.length > 0 && `Added: ${files.added.join(', ')}`,
    files.modified.length > 0 && `Modified: ${files.modified.join(', ')}`,
    files.removed.length > 0 && `Removed: ${files.removed.join(', ')}`,
  ].filter(Boolean).join('; ');

  return { ...files, summary };
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event');
  const delivery = req.headers.get('x-github-delivery');

  if (!signature || !event) {
    return NextResponse.json({ error: 'Missing headers' }, { status: 400 });
  }

  const payload = await req.text();

  if (!verifySignature(payload, signature)) {
    console.error('Invalid GitHub webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let data: GitHubWebhookPayload;
  try {
    data = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const admin = createAdminClient();
  let roomIdForLog: string | null = null;

  try {
    // Find room by GitHub repo
    const repoUrl = data.repository.html_url;
    const { data: room, error: roomError } = await admin
      .from('rooms')
      .select('id, nim_auto_broadcast, auto_task_progression, non_tech_translation, jury_expectations')
      .eq('github_repo', repoUrl)
      .single();

    if (roomError || !room) {
      console.log(`No room found for repo: ${repoUrl}`);
      return NextResponse.json({ received: true, message: 'No matching room' });
    }
    roomIdForLog = room.id;

    // Log webhook event
    await admin.from('nim_logs').insert({
      room_id: room.id,
      trigger_type: 'github_webhook',
      model_used: 'webhook_receiver',
      input_text: JSON.stringify({ event, delivery, repo: repoUrl }),
      success: true,
    });

    // Handle different events
    switch (event) {
      case 'push': {
        if (data.commits && data.commits.length > 0) {
          // Process each commit
          for (const commit of data.commits) {
            const files = commit.added.concat(commit.modified).concat(commit.removed);

            // Auto-task progression
            if (room.auto_task_progression) {
              await handleAutoTaskProgression(admin, room.id, commit, files);
            }

            // Non-technical translation for Pitch/Media
            if (room.non_tech_translation) {
              await handleNonTechTranslation(admin, room.id, commit, files);
            }

            // Code review with NIM (Qwen Coder)
            await handleCodeReview(admin, room.id, commit, files);

            // Check jury alignment if expectations exist
            if (room.jury_expectations) {
              await handleJuryAlignment(admin, room.id, commit, files);
            }
          }

          // Auto-broadcast mode
          if (room.nim_auto_broadcast) {
            await handleAutoBroadcast(admin, room.id, data.commits);
          }
        }
        break;
      }

      case 'pull_request': {
        if (data.pull_request?.merged && data.pull_request.number) {
          await handlePRMerged(admin, room.id, data.pull_request);
        }
        // Also trigger code review on PR open/update
        if (data.pull_request && (data.action === 'opened' || data.action === 'synchronize')) {
          await handlePRCodeReview(admin, room.id, data.pull_request);
        }
        break;
      }

      case 'issues': {
        if (data.issue && data.action) {
          await handleIssueEvent(admin, room.id, data.issue, data.action);
        }
        break;
      }

      case 'workflow_run': {
        // Handle CI/CD workflow completion
        await handleWorkflowRun(admin, room.id, data);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    if (roomIdForLog) {
      await admin.from('nim_logs').insert({
        room_id: roomIdForLog,
        trigger_type: 'github_webhook',
        model_used: 'webhook_receiver',
        input_text: JSON.stringify({ event, delivery }),
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function handleAutoTaskProgression(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  commit: NonNullable<GitHubWebhookPayload['commits']>[number],
  files: string[]
) {
  // Get open tasks in this room
  const { data: tasks } = await admin
    .from('tasks')
    .select('id, title, description, github_issue_number, status, assigned_to')
    .eq('room_id', roomId)
    .in('status', ['todo', 'in_progress', 'review']);

  if (!tasks || tasks.length === 0) return;

  // Match commits to tasks (simple keyword matching)
  for (const task of tasks) {
    const message = commit.message.toLowerCase();
    const taskKeywords = task.title.toLowerCase().split(' ').filter((w: string) => w.length > 3);
    const matches = taskKeywords.some((kw: string) => message.includes(kw));

    const issueMatch = task.github_issue_number && message.includes(`#${task.github_issue_number}`);

    if (matches || issueMatch) {
      // Mark as done
      await admin
        .from('tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', task.id);

      // Generate NIM summary
      const summary = await nimClient.summarizeTask(
        [{
          sha: commit.id,
          message: commit.message,
          author: commit.author.name,
          files,
        }],
        task.title,
        task.description
      );

      await admin
        .from('tasks')
        .update({ nim_summary: summary })
        .eq('id', task.id);

      // Notify assignee
      if (task.assigned_to) {
        await admin.from('notifications').insert({
          user_id: task.assigned_to,
          room_id: roomId,
          type: 'task_updated',
          title: `Task completed: ${task.title}`,
          content: { task_id: task.id, summary, commit_sha: commit.id },
          action_url: `/dashboard/rooms/${roomId}/tasks/${task.id}`,
        });
      }
    }
  }
}

async function handleAutoBroadcast(
  _admin: ReturnType<typeof createAdminClient>,
  _roomId: string,
  _commits: GitHubWebhookPayload['commits']
) {
  // Temporarily disabled until broadcast behavior is explicitly re-enabled.
}

async function handleNonTechTranslation(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  commit: NonNullable<GitHubWebhookPayload['commits']>[number],
  files: string[]
) {
  // Get Pitch/Media role members
  const { data: pitchMembers } = await admin
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('role_title', 'Pitch/Media')
    .eq('status', 'active');

  if (!pitchMembers || pitchMembers.length === 0) return;

  const translation = await nimClient.translateToNonTechnical(
    commit.message,
    `Files changed: ${files.join(', ')}`
  );

  // Send notification to each pitch member
  for (const member of pitchMembers) {
    await admin.from('notifications').insert({
      user_id: member.user_id,
      room_id: roomId,
      type: 'nim_alert',
      title: `Code Update: ${commit.message.split('\n')[0]}`,
      content: { translation, commit_sha: commit.id, author: commit.author.name, files },
      action_url: `/dashboard/rooms/${roomId}`,
    });
  }
}

async function handleCodeReview(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  commit: NonNullable<GitHubWebhookPayload['commits']>[number],
  files: string[]
) {
  // Only review significant changes
  if (files.length === 0) return;

  const diffSummary = files.join(', ');
  const review = await nimClient.reviewCode(
    `Commit: ${commit.message}\nFiles: ${diffSummary}`,
    detectLanguage(files),
    `Commit by ${commit.author.name}`
  );

  if (review.issues.some(i => i.severity === 'critical')) {
    // Notify team leads and code owners
    const { data: codeOwners } = await admin
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .or('flag_can_edit_repo.eq.true,role_title.eq.Backend,role_title.eq.Frontend,role_title.eq.DevOps');

    for (const owner of codeOwners || []) {
      await admin.from('notifications').insert({
        user_id: owner.user_id,
        room_id: roomId,
        type: 'nim_alert',
        title: `Code Review: Critical issues in ${commit.id.slice(0, 7)}`,
        content: {
          commit_sha: commit.id,
          issues: review.issues,
          summary: review.summary,
        },
        action_url: `/dashboard/rooms/${roomId}`,
      });
    }
  }
}

async function handleJuryAlignment(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  commit: NonNullable<GitHubWebhookPayload['commits']>[number],
  files: string[]
) {
  const { data: room } = await admin
    .from('rooms')
    .select('jury_expectations')
    .eq('id', roomId)
    .single();

  if (!room?.jury_expectations) return;

  // This would be triggered periodically, not on every commit
  // For now, just log that alignment check is needed
  await admin.from('nim_logs').insert({
    room_id: roomId,
    trigger_type: 'github_webhook',
    model_used: 'jury_alignment_trigger',
    input_text: JSON.stringify({
      commit_sha: commit.id,
      files,
      jury_expectations: room.jury_expectations.slice(0, 500),
    }),
    success: true,
  });
}

async function handlePRCodeReview(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  pr: GitHubWebhookPayload['pull_request']
) {
  if (!pr) return;

  // In a real implementation, fetch the PR diff from GitHub API
  // For now, log the PR for review
  await admin.from('nim_logs').insert({
    room_id: roomId,
    trigger_type: 'github_webhook',
    model_used: 'pr_review_queued',
    input_text: JSON.stringify({
      pr_number: pr.number,
      pr_title: pr.title,
      action: 'review_requested',
    }),
    success: true,
  });
}

async function handlePRMerged(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  pr: GitHubWebhookPayload['pull_request']
) {
  if (!pr || !pr.number) return;

  // Find task linked to this PR
  const { data: task } = await admin
    .from('tasks')
    .select('id, title, assigned_to')
    .eq('room_id', roomId)
    .eq('github_pr_number', pr.number)
    .single();

  if (task) {
    await admin
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', task.id);

    if (task.assigned_to) {
      await admin.from('notifications').insert({
        user_id: task.assigned_to,
        room_id: roomId,
        type: 'task_updated',
        title: `PR Merged: ${task.title}`,
        content: { task_id: task.id, pr_number: pr.number, pr_title: pr.title },
        action_url: `/dashboard/rooms/${roomId}/tasks/${task.id}`,
      });
    }
  }
}

async function handleIssueEvent(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  issue: GitHubWebhookPayload['issue'],
  action: string
) {
  if (!issue) return;

  // Sync issue to task if linked
  const { data: task } = await admin
    .from('tasks')
    .select('id, status')
    .eq('room_id', roomId)
    .eq('github_issue_number', issue.number)
    .single();

  if (task) {
    if (action === 'closed' && task.status !== 'done') {
      await admin
        .from('tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', task.id);
    } else if (action === 'reopened' && task.status === 'done') {
      await admin
        .from('tasks')
        .update({ status: 'todo' })
        .eq('id', task.id);
    }
  }
}

async function handleWorkflowRun(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  data: GitHubWebhookPayload
) {
  // Handle CI/CD workflow events
  // This would check workflow_run.conclusion and notify on failures
  console.log('Workflow run event received for room', roomId);
}

function detectLanguage(files: string[]): string {
  const extMap: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript/React',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript/React',
    '.rs': 'Rust',
    '.py': 'Python',
    '.go': 'Go',
    '.java': 'Java',
    '.kt': 'Kotlin',
    '.swift': 'Swift',
    '.dart': 'Dart',
    '.cpp': 'C++',
    '.c': 'C',
    '.cs': 'C#',
  };

  for (const file of files) {
    const ext = file.slice(file.lastIndexOf('.'));
    if (extMap[ext]) return extMap[ext];
  }
  return 'general';
}
