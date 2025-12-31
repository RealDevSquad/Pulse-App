/**
 * Script to construct a complete lifecycle timeline for a task from logs
 * Run with: pnpm exec tsx scripts/task-lifecycle.ts
 */

import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function getFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountJson = process.env.FIRESTORE_CONFIG;

  if (!serviceAccountJson) {
    throw new Error('FIRESTORE_CONFIG environment variable is not set');
  }

  const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

const app = getFirebaseAdmin();
const db = getFirestore(app);

// Task ID to inspect
const TASK_ID = process.argv[2] || '69N7LQLtOglFp8LUrfLL';

// Lifecycle event types
type LifecycleEventType = 
  | 'CREATED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'STATUS_CHANGE'
  | 'PROGRESS_UPDATE'
  | 'DEADLINE_CHANGE'
  | 'EXTENSION_REQUESTED'
  | 'EXTENSION_APPROVED'
  | 'EXTENSION_DENIED'
  | 'TASK_REQUEST_CREATED'
  | 'TASK_REQUEST_APPROVED'
  | 'TASK_REQUEST_REJECTED';

interface LifecycleEvent {
  timestamp: Date;
  type: LifecycleEventType;
  actor?: string;
  actorId?: string;
  details: string;
  rawData?: Record<string, unknown>;
}

interface TaskData {
  id: string;
  title: string;
  status: string;
  assignee?: string;
  assigneeName?: string;
  createdAt?: number;
  updatedAt?: number;
  startedOn?: number;
  endsOn?: number;
  createdBy?: string;
  percentCompleted?: number;
}

// Cache for user lookups
const userCache: Map<string, string> = new Map();

async function getUserName(userId: string): Promise<string> {
  if (!userId) return 'Unknown';
  
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const data = userDoc.data()!;
      const name = `@${data.username || userId}`;
      userCache.set(userId, name);
      return name;
    }
  } catch {
    // Ignore errors
  }
  
  userCache.set(userId, userId);
  return userId;
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function formatEpochSeconds(epochSeconds: number): string {
  return formatDate(new Date(epochSeconds * 1000));
}

async function getTaskLifecycle(taskId: string): Promise<{
  task: TaskData | null;
  events: LifecycleEvent[];
}> {
  const events: LifecycleEvent[] = [];

  // 1. Get the task document
  const taskDoc = await db.collection('tasks').doc(taskId).get();
  
  if (!taskDoc.exists) {
    return { task: null, events: [] };
  }

  const taskData = taskDoc.data()!;
  const task: TaskData = {
    id: taskId,
    title: taskData.title,
    status: taskData.status,
    assignee: taskData.assignee,
    createdAt: taskData.createdAt,
    updatedAt: taskData.updatedAt,
    startedOn: taskData.startedOn,
    endsOn: taskData.endsOn,
    createdBy: taskData.createdBy,
    percentCompleted: taskData.percentCompleted,
  };

  // Get assignee name
  if (task.assignee) {
    task.assigneeName = await getUserName(task.assignee);
  }

  // 2. Add CREATED event from task document
  if (task.createdAt) {
    const creatorName = task.createdBy ? await getUserName(task.createdBy) : undefined;
    events.push({
      timestamp: new Date(task.createdAt * 1000),
      type: 'CREATED',
      actor: creatorName,
      actorId: task.createdBy,
      details: `Task created: "${task.title}"`,
    });
  }

  // 3. Get all logs for this task (via meta.taskId)
  const logsSnapshot = await db.collection('logs')
    .where('meta.taskId', '==', taskId)
    .limit(500)
    .get();

  for (const doc of logsSnapshot.docs) {
    const log = doc.data();
    const timestamp = log.timestamp?._seconds 
      ? new Date(log.timestamp._seconds * 1000)
      : null;
    
    if (!timestamp) continue;

    const actor = log.meta?.username ? `@${log.meta.username}` : undefined;
    const actorId = log.meta?.userId;

    // Status changes
    if (log.body?.new?.status && log.body?.old?.status !== log.body?.new?.status) {
      events.push({
        timestamp,
        type: 'STATUS_CHANGE',
        actor,
        actorId,
        details: `Status: ${log.body.old?.status || 'N/A'} → ${log.body.new.status}`,
        rawData: { old: log.body.old?.status, new: log.body.new.status },
      });
    }

    // Assignment changes
    if (log.body?.new?.assignee !== undefined) {
      const oldAssignee = log.body.old?.assignee;
      const newAssignee = log.body.new.assignee;
      
      if (newAssignee && newAssignee !== oldAssignee) {
        const newAssigneeName = await getUserName(newAssignee);
        events.push({
          timestamp,
          type: 'ASSIGNED',
          actor,
          actorId,
          details: oldAssignee 
            ? `Reassigned: ${await getUserName(oldAssignee)} → ${newAssigneeName}`
            : `Assigned to ${newAssigneeName}`,
          rawData: { old: oldAssignee, new: newAssignee },
        });
      } else if (!newAssignee && oldAssignee) {
        events.push({
          timestamp,
          type: 'UNASSIGNED',
          actor,
          actorId,
          details: `Unassigned from ${await getUserName(oldAssignee)}`,
          rawData: { old: oldAssignee },
        });
      }
    }

    // Progress updates
    if (log.body?.new?.percentCompleted !== undefined) {
      const oldPercent = log.body.old?.percentCompleted ?? 0;
      const newPercent = log.body.new.percentCompleted;
      if (oldPercent !== newPercent) {
        events.push({
          timestamp,
          type: 'PROGRESS_UPDATE',
          actor,
          actorId,
          details: `Progress: ${oldPercent}% → ${newPercent}%`,
          rawData: { old: oldPercent, new: newPercent },
        });
      }
    }

    // Deadline changes (from task logs)
    if (log.body?.new?.endsOn !== undefined) {
      const oldEndsOn = log.body.old?.endsOn;
      const newEndsOn = log.body.new.endsOn;
      if (oldEndsOn !== newEndsOn) {
        events.push({
          timestamp,
          type: 'DEADLINE_CHANGE',
          actor,
          actorId,
          details: oldEndsOn 
            ? `Deadline: ${formatEpochSeconds(oldEndsOn)} → ${formatEpochSeconds(newEndsOn)}`
            : `Deadline set: ${formatEpochSeconds(newEndsOn)}`,
          rawData: { old: oldEndsOn, new: newEndsOn },
        });
      }
    }

    // Extension requests (type: extensionRequests)
    if (log.type === 'extensionRequests') {
      const status = log.body?.status;
      const oldEndsOn = log.body?.oldEndsOn;
      const newEndsOn = log.body?.newEndsOn;
      
      if (status === 'PENDING') {
        events.push({
          timestamp,
          type: 'EXTENSION_REQUESTED',
          actor,
          actorId,
          details: `Extension requested: ${oldEndsOn ? formatEpochSeconds(oldEndsOn) : 'N/A'} → ${newEndsOn ? formatEpochSeconds(newEndsOn) : 'N/A'}`,
          rawData: { oldEndsOn, newEndsOn, status },
        });
      } else if (status === 'APPROVED') {
        events.push({
          timestamp,
          type: 'EXTENSION_APPROVED',
          actor,
          actorId,
          details: `Extension approved: ${newEndsOn ? formatEpochSeconds(newEndsOn) : 'N/A'}`,
          rawData: { oldEndsOn, newEndsOn, status },
        });
      } else if (status === 'DENIED') {
        events.push({
          timestamp,
          type: 'EXTENSION_DENIED',
          actor,
          actorId,
          details: `Extension denied`,
          rawData: { oldEndsOn, newEndsOn, status },
        });
      }
    }
  }

  // 4. Get task requests (via body.taskId)
  const taskRequestsSnapshot = await db.collection('logs')
    .where('type', '==', 'taskRequests')
    .where('body.taskId', '==', taskId)
    .limit(100)
    .get();

  for (const doc of taskRequestsSnapshot.docs) {
    const log = doc.data();
    const timestamp = log.timestamp?._seconds 
      ? new Date(log.timestamp._seconds * 1000)
      : null;
    
    if (!timestamp) continue;

    const actor = log.meta?.username ? `@${log.meta.username}` : undefined;
    const actorId = log.meta?.userId;
    const status = log.body?.status;
    const approvedTo = log.body?.approvedTo;
    const requestedBy = log.body?.requestedBy;

    if (status === 'PENDING' || log.meta?.action === 'create') {
      const requesterName = requestedBy ? await getUserName(requestedBy) : 'Unknown';
      events.push({
        timestamp,
        type: 'TASK_REQUEST_CREATED',
        actor: requesterName,
        actorId: requestedBy,
        details: `Task request created by ${requesterName}`,
        rawData: { status, requestedBy },
      });
    }
    
    if (status === 'APPROVED') {
      const assigneeName = approvedTo ? await getUserName(approvedTo) : 'Unknown';
      events.push({
        timestamp,
        type: 'TASK_REQUEST_APPROVED',
        actor,
        actorId,
        details: `Task request approved, assigned to ${assigneeName}`,
        rawData: { status, approvedTo, approvedBy: actorId },
      });
    }
    
    if (status === 'REJECTED') {
      events.push({
        timestamp,
        type: 'TASK_REQUEST_REJECTED',
        actor,
        actorId,
        details: `Task request rejected`,
        rawData: { status, rejectedBy: actorId },
      });
    }
  }

  // 5. Sort events chronologically
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // 6. Deduplicate events that are too close together (within 2 seconds) with same type
  const deduped: LifecycleEvent[] = [];
  for (const event of events) {
    const last = deduped[deduped.length - 1];
    if (last && 
        last.type === event.type && 
        Math.abs(last.timestamp.getTime() - event.timestamp.getTime()) < 2000 &&
        last.details === event.details) {
      continue; // Skip duplicate
    }
    deduped.push(event);
  }

  return { task, events: deduped };
}

function getEventIcon(type: LifecycleEventType): string {
  const icons: Record<LifecycleEventType, string> = {
    'CREATED': '🆕',
    'ASSIGNED': '👤',
    'UNASSIGNED': '👤',
    'STATUS_CHANGE': '🔄',
    'PROGRESS_UPDATE': '📊',
    'DEADLINE_CHANGE': '📅',
    'EXTENSION_REQUESTED': '⏳',
    'EXTENSION_APPROVED': '✅',
    'EXTENSION_DENIED': '❌',
    'TASK_REQUEST_CREATED': '📝',
    'TASK_REQUEST_APPROVED': '✅',
    'TASK_REQUEST_REJECTED': '❌',
  };
  return icons[type] || '•';
}

async function main() {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  TASK LIFECYCLE: ${TASK_ID}`);
  console.log(`${'═'.repeat(80)}\n`);

  const { task, events } = await getTaskLifecycle(TASK_ID);

  if (!task) {
    console.log('❌ Task not found!\n');
    return;
  }

  // Print task summary
  console.log('📋 TASK SUMMARY');
  console.log(`${'─'.repeat(80)}`);
  console.log(`  Title:      ${task.title}`);
  console.log(`  Status:     ${task.status}`);
  console.log(`  Assignee:   ${task.assigneeName || 'Unassigned'}`);
  console.log(`  Progress:   ${task.percentCompleted ?? 0}%`);
  if (task.endsOn) {
    console.log(`  Deadline:   ${formatEpochSeconds(task.endsOn)}`);
  }
  if (task.startedOn) {
    console.log(`  Started:    ${formatEpochSeconds(task.startedOn)}`);
  }

  // Print timeline
  console.log(`\n\n📜 LIFECYCLE TIMELINE (${events.length} events)`);
  console.log(`${'─'.repeat(80)}`);

  if (events.length === 0) {
    console.log('  No lifecycle events found.\n');
    return;
  }

  for (const event of events) {
    const icon = getEventIcon(event.type);
    const actor = event.actor ? ` by ${event.actor}` : '';
    console.log(`  ${formatDate(event.timestamp)} │ ${icon} ${event.details}${actor}`);
  }

  // Print statistics
  console.log(`\n\n📊 STATISTICS`);
  console.log(`${'─'.repeat(80)}`);
  
  const statusChanges = events.filter(e => e.type === 'STATUS_CHANGE');
  const progressUpdates = events.filter(e => e.type === 'PROGRESS_UPDATE');
  const extensionRequests = events.filter(e => e.type.startsWith('EXTENSION_'));
  
  console.log(`  Status changes:      ${statusChanges.length}`);
  console.log(`  Progress updates:    ${progressUpdates.length}`);
  console.log(`  Extension requests:  ${extensionRequests.length}`);

  // Calculate time in each status
  if (statusChanges.length > 0) {
    console.log(`\n  Status transitions:`);
    for (const change of statusChanges) {
      const data = change.rawData as { old?: string; new?: string };
      console.log(`    • ${data.old || 'N/A'} → ${data.new}`);
    }
  }

  // Time from creation to first IN_PROGRESS
  const createdEvent = events.find(e => e.type === 'CREATED');
  const firstInProgress = events.find(e => 
    e.type === 'STATUS_CHANGE' && 
    (e.rawData as { new?: string })?.new === 'IN_PROGRESS'
  );
  
  if (createdEvent && firstInProgress) {
    const daysToStart = (firstInProgress.timestamp.getTime() - createdEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    console.log(`\n  Time to start:       ${daysToStart.toFixed(1)} days`);
  }

  // Time from first IN_PROGRESS to COMPLETED/DONE
  const completedEvent = events.find(e => 
    e.type === 'STATUS_CHANGE' && 
    ['COMPLETED', 'DONE', 'VERIFIED'].includes((e.rawData as { new?: string })?.new || '')
  );
  
  if (firstInProgress && completedEvent) {
    const daysToComplete = (completedEvent.timestamp.getTime() - firstInProgress.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    console.log(`  Time to complete:    ${daysToComplete.toFixed(1)} days`);
  }

  console.log(`\n${'═'.repeat(80)}\n`);
}

main().catch(console.error);
