import { db } from './firebase-admin';

// Lifecycle event types
export type LifecycleEventType =
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

export interface LifecycleEvent {
  timestamp: number; // ms since epoch
  type: LifecycleEventType;
  actor?: string;
  actorId?: string;
  details: string;
  oldValue?: string | number;
  newValue?: string | number;
}

export interface TaskDetails {
  id: string;
  title: string;
  status: string;
  assignee?: string;
  assigneeName?: string;
  assigneePicture?: string;
  createdAt?: number;
  updatedAt?: number;
  startedOn?: number;
  endsOn?: number;
  createdBy?: string;
  percentCompleted?: number;
  type?: string;
  priority?: string;
  github?: {
    issue?: {
      html_url?: string;
    };
  };
}

export interface TaskLifecycle {
  task: TaskDetails;
  events: LifecycleEvent[];
  stats: {
    statusChanges: number;
    progressUpdates: number;
    extensionRequests: number;
    daysToStart?: number;
    daysToComplete?: number;
  };
}

// Cache for user lookups
const userCache: Map<string, { username: string; picture?: string }> = new Map();

async function getUserInfo(userId: string): Promise<{ username: string; picture?: string }> {
  if (!userId) return { username: 'Unknown' };

  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const data = userDoc.data()!;
      const info = {
        username: data.username || userId,
        picture: data.picture?.url,
      };
      userCache.set(userId, info);
      return info;
    }
  } catch {
    // Ignore errors
  }

  const fallback = { username: userId };
  userCache.set(userId, fallback);
  return fallback;
}

function formatEpochSeconds(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function getTaskLifecycle(taskId: string): Promise<TaskLifecycle | null> {
  const events: LifecycleEvent[] = [];

  // 1. Get the task document
  const taskDoc = await db.collection('tasks').doc(taskId).get();

  if (!taskDoc.exists) {
    return null;
  }

  const taskData = taskDoc.data()!;
  const task: TaskDetails = {
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
    type: taskData.type,
    priority: taskData.priority,
    github: taskData.github,
  };

  // Get assignee info
  if (task.assignee) {
    const assigneeInfo = await getUserInfo(task.assignee);
    task.assigneeName = assigneeInfo.username;
    task.assigneePicture = assigneeInfo.picture;
  }

  // 2. Add CREATED event from task document
  if (task.createdAt) {
    const creatorInfo = task.createdBy ? await getUserInfo(task.createdBy) : null;
    events.push({
      timestamp: task.createdAt * 1000,
      type: 'CREATED',
      actor: creatorInfo?.username,
      actorId: task.createdBy,
      details: 'Task created',
    });
  }

  // 3. Get all logs for this task (via meta.taskId)
  const logsSnapshot = await db
    .collection('logs')
    .where('meta.taskId', '==', taskId)
    .limit(500)
    .get();

  for (const doc of logsSnapshot.docs) {
    const log = doc.data();
    const timestamp = log.timestamp?._seconds ? log.timestamp._seconds * 1000 : null;

    if (!timestamp) continue;

    const actor = log.meta?.username || undefined;
    const actorId = log.meta?.userId;

    // Status changes
    if (log.body?.new?.status && log.body?.old?.status !== log.body?.new?.status) {
      events.push({
        timestamp,
        type: 'STATUS_CHANGE',
        actor,
        actorId,
        details: `Status changed to ${log.body.new.status}`,
        oldValue: log.body.old?.status,
        newValue: log.body.new.status,
      });
    }

    // Assignment changes
    if (log.body?.new?.assignee !== undefined) {
      const oldAssignee = log.body.old?.assignee;
      const newAssignee = log.body.new.assignee;

      if (newAssignee && newAssignee !== oldAssignee) {
        const newAssigneeInfo = await getUserInfo(newAssignee);
        events.push({
          timestamp,
          type: 'ASSIGNED',
          actor,
          actorId,
          details: oldAssignee
            ? `Reassigned to ${newAssigneeInfo.username}`
            : `Assigned to ${newAssigneeInfo.username}`,
          oldValue: oldAssignee,
          newValue: newAssignee,
        });
      } else if (!newAssignee && oldAssignee) {
        const oldAssigneeInfo = await getUserInfo(oldAssignee);
        events.push({
          timestamp,
          type: 'UNASSIGNED',
          actor,
          actorId,
          details: `Unassigned from ${oldAssigneeInfo.username}`,
          oldValue: oldAssignee,
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
          details: `Progress updated to ${newPercent}%`,
          oldValue: oldPercent,
          newValue: newPercent,
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
            ? `Deadline changed to ${formatEpochSeconds(newEndsOn)}`
            : `Deadline set to ${formatEpochSeconds(newEndsOn)}`,
          oldValue: oldEndsOn,
          newValue: newEndsOn,
        });
      }
    }

    // Extension requests (type: extensionRequests)
    if (log.type === 'extensionRequests') {
      const status = log.body?.status;
      const newEndsOn = log.body?.newEndsOn;

      if (status === 'PENDING') {
        events.push({
          timestamp,
          type: 'EXTENSION_REQUESTED',
          actor,
          actorId,
          details: newEndsOn 
            ? `Extension requested to ${formatEpochSeconds(newEndsOn)}`
            : 'Extension requested',
          oldValue: log.body?.oldEndsOn,
          newValue: newEndsOn,
        });
      } else if (status === 'APPROVED') {
        events.push({
          timestamp,
          type: 'EXTENSION_APPROVED',
          actor,
          actorId,
          details: newEndsOn 
            ? `Extension approved to ${formatEpochSeconds(newEndsOn)}`
            : 'Extension approved',
          newValue: newEndsOn,
        });
      } else if (status === 'DENIED') {
        events.push({
          timestamp,
          type: 'EXTENSION_DENIED',
          actor,
          actorId,
          details: 'Extension denied',
        });
      }
    }
  }

  // 4. Get task requests (via body.taskId)
  const taskRequestsSnapshot = await db
    .collection('logs')
    .where('type', '==', 'taskRequests')
    .where('body.taskId', '==', taskId)
    .limit(100)
    .get();

  for (const doc of taskRequestsSnapshot.docs) {
    const log = doc.data();
    const timestamp = log.timestamp?._seconds ? log.timestamp._seconds * 1000 : null;

    if (!timestamp) continue;

    const actor = log.meta?.username || undefined;
    const actorId = log.meta?.userId;
    const status = log.body?.status;
    const approvedTo = log.body?.approvedTo;
    const requestedBy = log.body?.requestedBy;

    if (status === 'PENDING' || log.meta?.action === 'create') {
      const requesterInfo = requestedBy ? await getUserInfo(requestedBy) : null;
      events.push({
        timestamp,
        type: 'TASK_REQUEST_CREATED',
        actor: requesterInfo?.username,
        actorId: requestedBy,
        details: `Task request created`,
      });
    }

    if (status === 'APPROVED') {
      const assigneeInfo = approvedTo ? await getUserInfo(approvedTo) : null;
      events.push({
        timestamp,
        type: 'TASK_REQUEST_APPROVED',
        actor,
        actorId,
        details: `Task request approved, assigned to ${assigneeInfo?.username || 'Unknown'}`,
        newValue: approvedTo,
      });
    }

    if (status === 'REJECTED') {
      events.push({
        timestamp,
        type: 'TASK_REQUEST_REJECTED',
        actor,
        actorId,
        details: 'Task request rejected',
      });
    }
  }

  // 5. Sort events chronologically
  events.sort((a, b) => a.timestamp - b.timestamp);

  // 6. Deduplicate events that are too close together (within 2 seconds) with same type
  const deduped: LifecycleEvent[] = [];
  for (const event of events) {
    const last = deduped[deduped.length - 1];
    if (
      last &&
      last.type === event.type &&
      Math.abs(last.timestamp - event.timestamp) < 2000 &&
      last.details === event.details
    ) {
      continue; // Skip duplicate
    }
    deduped.push(event);
  }

  // 7. Calculate statistics
  const statusChanges = deduped.filter((e) => e.type === 'STATUS_CHANGE').length;
  const progressUpdates = deduped.filter((e) => e.type === 'PROGRESS_UPDATE').length;
  const extensionRequests = deduped.filter((e) => e.type.startsWith('EXTENSION_')).length;

  // Time from creation to first IN_PROGRESS
  const createdEvent = deduped.find((e) => e.type === 'CREATED');
  const firstInProgress = deduped.find(
    (e) => e.type === 'STATUS_CHANGE' && e.newValue === 'IN_PROGRESS'
  );
  const daysToStart =
    createdEvent && firstInProgress
      ? (firstInProgress.timestamp - createdEvent.timestamp) / (1000 * 60 * 60 * 24)
      : undefined;

  // Time from first IN_PROGRESS to COMPLETED/DONE
  const completedEvent = deduped.find(
    (e) =>
      e.type === 'STATUS_CHANGE' &&
      ['COMPLETED', 'DONE', 'VERIFIED'].includes(e.newValue as string)
  );
  const daysToComplete =
    firstInProgress && completedEvent
      ? (completedEvent.timestamp - firstInProgress.timestamp) / (1000 * 60 * 60 * 24)
      : undefined;

  return {
    task,
    events: deduped,
    stats: {
      statusChanges,
      progressUpdates,
      extensionRequests,
      daysToStart: daysToStart ? Math.round(daysToStart * 10) / 10 : undefined,
      daysToComplete: daysToComplete ? Math.round(daysToComplete * 10) / 10 : undefined,
    },
  };
}
