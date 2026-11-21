import test from 'node:test';
import assert from 'node:assert/strict';
import { getPanicTasks, formatRemainingTime, getHackTimerState } from '../utils';
import type { Task } from '@/types/database';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    room_id: 'room-1',
    created_by: 'user-1',
    assigned_to: 'user-1',
    title: 'Test Task',
    description: null,
    status: 'todo',
    category: 'code',
    priority: 0,
    github_issue_number: null,
    github_pr_number: null,
    related_asset_ids: [],
    due_date: null,
    completed_at: null,
    nim_summary: null,
    is_blocker: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

test('getPanicTasks: completed tasks are hidden', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const nowMs = now.getTime();

  const completedDone = createTask({
    id: 'completed-1',
    status: 'done',
    due_date: new Date(nowMs + 30 * 60 * 1000).toISOString(),
    is_blocker: true, // Even if blocker, completed must be hidden
  });

  const completedWithCompletedAt = createTask({
    id: 'completed-2',
    status: 'todo',
    completed_at: new Date(nowMs - 1000).toISOString(),
    due_date: new Date(nowMs + 30 * 60 * 1000).toISOString(),
  });

  const openUrgent = createTask({
    id: 'open-1',
    status: 'in_progress',
    due_date: new Date(nowMs + 30 * 60 * 1000).toISOString(),
  });

  const result = getPanicTasks([completedDone, completedWithCompletedAt, openUrgent], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'open-1');
});

test('getPanicTasks: blocker is shown regardless of due date', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const nowMs = now.getTime();

  const blockerNoDueDate = createTask({
    id: 'blocker-no-due',
    is_blocker: true,
    due_date: null,
  });

  const blockerFarFuture = createTask({
    id: 'blocker-future',
    is_blocker: true,
    due_date: new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days later
  });

  const blockerStatus = createTask({
    id: 'blocker-status-enum',
    status: 'blocked',
    due_date: null,
  });

  const regularNoDue = createTask({
    id: 'regular-no-due',
    status: 'todo',
    due_date: null,
  });

  const result = getPanicTasks([blockerNoDueDate, blockerFarFuture, blockerStatus, regularNoDue], now);
  const resultIds = result.map((t) => t.id);

  assert.ok(resultIds.includes('blocker-no-due'));
  assert.ok(resultIds.includes('blocker-future'));
  assert.ok(resultIds.includes('blocker-status-enum'));
  assert.ok(!resultIds.includes('regular-no-due'));
  assert.equal(result.length, 3);
});

test('getPanicTasks: task due in 119 min is shown', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const nowMs = now.getTime();

  const taskDue119Min = createTask({
    id: 'task-119',
    due_date: new Date(nowMs + 119 * 60 * 1000).toISOString(),
    status: 'todo',
  });

  const result = getPanicTasks([taskDue119Min], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-119');
});

test('getPanicTasks: task due in 121 min is hidden', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const nowMs = now.getTime();

  const taskDue121Min = createTask({
    id: 'task-121',
    due_date: new Date(nowMs + 121 * 60 * 1000).toISOString(),
    status: 'todo',
    is_blocker: false,
  });

  const result = getPanicTasks([taskDue121Min], now);
  assert.equal(result.length, 0);
});

test('getPanicTasks: overdue open task is shown', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const nowMs = now.getTime();

  const overdueTask = createTask({
    id: 'overdue-task',
    status: 'in_progress',
    due_date: new Date(nowMs - 45 * 60 * 1000).toISOString(), // 45 min ago
  });

  const result = getPanicTasks([overdueTask], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'overdue-task');
});

test('getPanicTasks: no-due-date non-blocker is hidden', () => {
  const now = new Date('2026-11-17T12:00:00Z');

  const regularOpenTask = createTask({
    id: 'regular-open',
    status: 'todo',
    due_date: null,
    is_blocker: false,
  });

  const result = getPanicTasks([regularOpenTask], now);
  assert.equal(result.length, 0);
});

test('getPanicTasks: sorts blockers first, then by due_at/due_date ascending', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const nowMs = now.getTime();

  const urgentEarlier = createTask({
    id: 'urgent-30m',
    due_date: new Date(nowMs + 30 * 60 * 1000).toISOString(),
    is_blocker: false,
  });

  const urgentLater = createTask({
    id: 'urgent-90m',
    due_date: new Date(nowMs + 90 * 60 * 1000).toISOString(),
    is_blocker: false,
  });

  const blockerFar = createTask({
    id: 'blocker-far',
    due_date: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
    is_blocker: true,
  });

  const blockerNoDue = createTask({
    id: 'blocker-no-due',
    due_date: null,
    is_blocker: true,
  });

  const result = getPanicTasks([urgentLater, urgentEarlier, blockerNoDue, blockerFar], now);
  const ids = result.map((t) => t.id);

  // Both blockers must be first
  assert.ok(ids.indexOf('blocker-far') < 2);
  assert.ok(ids.indexOf('blocker-no-due') < 2);

  // urgentEarlier (30m) must be before urgentLater (90m)
  assert.ok(ids.indexOf('urgent-30m') < ids.indexOf('urgent-90m'));
});

test('formatRemainingTime: outputs correct format per threshold', () => {
  // > 48h -> DDd HHh
  const seventyHoursMs = 70 * 60 * 60 * 1000;
  assert.equal(formatRemainingTime(seventyHoursMs), '02d 22h');

  // between 10m and 48h -> HHh MMm
  const fiveHours23MinsMs = (5 * 60 + 23) * 60 * 1000;
  assert.equal(formatRemainingTime(fiveHours23MinsMs), '05h 23m');

  // under 10m -> MMm SSs
  const nineMins42SecsMs = (9 * 60 + 42) * 1000;
  assert.equal(formatRemainingTime(nineMins42SecsMs), '09m 42s');

  // expired -> Submissions closed
  assert.equal(formatRemainingTime(0), 'Submissions closed');
  assert.equal(formatRemainingTime(-5000), 'Submissions closed');
});

test('getHackTimerState: correctly classifies thresholds', () => {
  assert.equal(getHackTimerState(8 * 3600 * 1000), 'normal');
  assert.equal(getHackTimerState(6 * 3600 * 1000), 'warning');
  assert.equal(getHackTimerState(3 * 3600 * 1000), 'warning');
  assert.equal(getHackTimerState(2 * 3600 * 1000), 'critical');
  assert.equal(getHackTimerState(30 * 60 * 1000), 'critical');
  assert.equal(getHackTimerState(0), 'passed');
  assert.equal(getHackTimerState(-1000), 'passed');
});
