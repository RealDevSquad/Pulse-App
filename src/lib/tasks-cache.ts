import { unstable_cache } from 'next/cache';
import { db } from './firebase-admin';
import type { Task, User } from '@/types';

export interface TaskWithAssignee extends Task {
  assigneeUser?: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    picture?: { url: string };
  } | null;
  /** Latest activity timestamp (max of updatedAt, progress updates) in ms */
  latestActivityAt?: number;
}

export type TaskSortField = 'title' | 'status' | 'updatedAt' | 'createdAt' | 'percentCompleted' | 'endsOn';
export type SortOrder = 'asc' | 'desc';
export type TaskStatusFilter = 'all' | 'active' | 'review' | 'completed' | 'blocked' | 'backlog' | 'overdue';

// Task status categories
const ACTIVE_STATUSES = ['ASSIGNED', 'IN_PROGRESS'];
const DONE_STATUSES = ['COMPLETED', 'DONE'];
const BLOCKED_STATUSES = ['BLOCKED'];
const BACKLOG_STATUSES = ['BACKLOG', 'TODO'];
const REVIEW_STATUSES = ['NEEDS_REVIEW', 'IN_REVIEW', 'SANITY_CHECK', 'VERIFIED', 'MERGED'];

// Active work statuses for overdue filtering (excludes backlog/todo)
const ACTIVE_WORK_STATUSES = [...ACTIVE_STATUSES, ...BLOCKED_STATUSES, ...REVIEW_STATUSES];

export interface GetCachedTasksOptions {
  sortBy?: TaskSortField;
  sortOrder?: SortOrder;
  statusFilter?: TaskStatusFilter;
  assigneeId?: string;
  limit?: number;
  offset?: number;
}

export interface GetCachedTasksResult {
  tasks: TaskWithAssignee[];
  total: number;
  hasMore: boolean;
}

/**
 * Core function to fetch tasks by status with assignee data and latest activity.
 * Not cached - used by cached wrappers below.
 */
async function fetchTasksCore(statuses: string[], label: string, taskLimit: number = 100): Promise<TaskWithAssignee[]> {
  console.log(`[Cache] Fetching ${label} tasks (limit ${taskLimit})...`);

  // Fetch tasks by status
  let tasks: Task[] = [];
  
  for (const status of statuses) {
    const tasksSnapshot = await db
      .collection('tasks')
      .where('status', '==', status)
      .orderBy('updatedAt', 'desc')
      .limit(taskLimit)
      .get();

    const statusTasks: Task[] = tasksSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Task));
    
    tasks = tasks.concat(statusTasks);
  }

  // Dedupe and limit
  const seenIds = new Set<string>();
  tasks = tasks.filter((t) => {
    if (seenIds.has(t.id)) return false;
    seenIds.add(t.id);
    return true;
  }).slice(0, taskLimit);

  if (tasks.length === 0) {
    return [];
  }

  // Get unique assignee IDs
  const assigneeIds = [...new Set(tasks.map((t) => t.assignee).filter(Boolean))] as string[];

  // Fetch user data for all assignees in batches of 30
  const usersMap = new Map<string, TaskWithAssignee['assigneeUser']>();
  const batchSize = 30;
  
  for (let i = 0; i < assigneeIds.length; i += batchSize) {
    const batch = assigneeIds.slice(i, i + batchSize);
    
    if (batch.length > 0) {
      const usersSnapshot = await db
        .collection('users')
        .where('__name__', 'in', batch)
        .get();

      usersSnapshot.docs.forEach((doc) => {
        const data = doc.data() as User;
        usersMap.set(doc.id, {
          id: doc.id,
          username: data.username,
          first_name: data.first_name,
          last_name: data.last_name,
          picture: data.picture,
        });
      });
    }
  }

  // Fetch progresses for all tasks in batches of 30
  const taskIds = tasks.map((t) => t.id);
  const latestProgressMap = new Map<string, number>();

  for (let i = 0; i < taskIds.length; i += batchSize) {
    const batch = taskIds.slice(i, i + batchSize);
    
    if (batch.length > 0) {
      const progressSnapshot = await db
        .collection('progresses')
        .where('taskId', 'in', batch)
        .get();

      // Find latest progress per task
      for (const doc of progressSnapshot.docs) {
        const data = doc.data();
        const taskId = data.taskId as string;
        const createdAt = data.createdAt as number;
        if (taskId && createdAt) {
          const current = latestProgressMap.get(taskId) || 0;
          if (createdAt > current) {
            latestProgressMap.set(taskId, createdAt);
          }
        }
      }
    }
  }

  // Combine tasks with assignee info and compute latestActivityAt
  const tasksWithAssignees: TaskWithAssignee[] = tasks.map((task) => {
    const updatedAtMs = task.updatedAt ? task.updatedAt * 1000 : 0;
    const updatedAtAltMs = task.updated_at || 0;
    const latestProgressMs = latestProgressMap.get(task.id) || 0;
    const latestActivityAt = Math.max(updatedAtMs, updatedAtAltMs, latestProgressMs);

    return {
      ...task,
      assigneeUser: task.assignee ? usersMap.get(task.assignee) || null : null,
      latestActivityAt,
    };
  });

  console.log(`[Cache] Fetched ${tasksWithAssignees.length} ${label} tasks`);
  return tasksWithAssignees;
}

// Cached fetchers for each status filter (5 min cache each)
const fetchActiveTasks = unstable_cache(
  () => fetchTasksCore(ACTIVE_STATUSES, 'active', 100),
  ['tasks-active'],
  { revalidate: 300 }
);

const fetchReviewTasks = unstable_cache(
  () => fetchTasksCore(REVIEW_STATUSES, 'review', 100),
  ['tasks-review'],
  { revalidate: 300 }
);

const fetchCompletedTasks = unstable_cache(
  () => fetchTasksCore(DONE_STATUSES, 'completed', 100),
  ['tasks-completed'],
  { revalidate: 300 }
);

const fetchBlockedTasks = unstable_cache(
  () => fetchTasksCore(BLOCKED_STATUSES, 'blocked', 100),
  ['tasks-blocked'],
  { revalidate: 300 }
);

const fetchBacklogTasks = unstable_cache(
  () => fetchTasksCore(BACKLOG_STATUSES, 'backlog', 100),
  ['tasks-backlog'],
  { revalidate: 300 }
);

/**
 * Fetch overdue tasks - assigned tasks past due date in active work statuses.
 * Uses server-side filtering with endsOn < now query.
 */
async function fetchOverdueTasksCore(): Promise<{ tasks: TaskWithAssignee[]; count: number }> {
  const now = Math.floor(Date.now() / 1000);
  console.log(`[Cache] Fetching overdue tasks (endsOn < ${now})...`);

  let allOverdueTasks: Task[] = [];

  // Query each active work status for overdue tasks
  // Firestore requires separate queries per status since we can't combine IN with <
  for (const status of ACTIVE_WORK_STATUSES) {
    const snapshot = await db
      .collection('tasks')
      .where('status', '==', status)
      .where('endsOn', '<', now)
      .orderBy('endsOn', 'desc')
      .limit(500) // Higher limit to get all overdue
      .get();

    const tasks: Task[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Task));

    allOverdueTasks = allOverdueTasks.concat(tasks);
  }

  // Filter for assigned tasks only and dedupe
  const seenIds = new Set<string>();
  allOverdueTasks = allOverdueTasks.filter((t) => {
    if (!t.assignee) return false;
    if (seenIds.has(t.id)) return false;
    seenIds.add(t.id);
    return true;
  });

  const totalCount = allOverdueTasks.length;

  // Limit for display (keep first 200 for pagination)
  const limitedTasks = allOverdueTasks.slice(0, 200);

  if (limitedTasks.length === 0) {
    return { tasks: [], count: 0 };
  }

  // Get unique assignee IDs
  const assigneeIds = [...new Set(limitedTasks.map((t) => t.assignee).filter(Boolean))] as string[];

  // Fetch user data for all assignees in batches of 30
  const usersMap = new Map<string, TaskWithAssignee['assigneeUser']>();
  const batchSize = 30;

  for (let i = 0; i < assigneeIds.length; i += batchSize) {
    const batch = assigneeIds.slice(i, i + batchSize);

    if (batch.length > 0) {
      const usersSnapshot = await db
        .collection('users')
        .where('__name__', 'in', batch)
        .get();

      usersSnapshot.docs.forEach((doc) => {
        const data = doc.data() as User;
        usersMap.set(doc.id, {
          id: doc.id,
          username: data.username,
          first_name: data.first_name,
          last_name: data.last_name,
          picture: data.picture,
        });
      });
    }
  }

  // Combine tasks with assignee info
  const tasksWithAssignees: TaskWithAssignee[] = limitedTasks.map((task) => {
    const updatedAtMs = task.updatedAt ? task.updatedAt * 1000 : 0;
    const updatedAtAltMs = task.updated_at || 0;
    const latestActivityAt = Math.max(updatedAtMs, updatedAtAltMs);

    return {
      ...task,
      assigneeUser: task.assignee ? usersMap.get(task.assignee) || null : null,
      latestActivityAt,
    };
  });

  console.log(`[Cache] Fetched ${tasksWithAssignees.length} overdue tasks (total: ${totalCount})`);
  return { tasks: tasksWithAssignees, count: totalCount };
}

const fetchOverdueTasks = unstable_cache(
  fetchOverdueTasksCore,
  ['tasks-overdue'],
  { revalidate: 300 }
);

// All statuses for "all tasks" view
const ALL_STATUSES = [...ACTIVE_STATUSES, ...REVIEW_STATUSES, ...DONE_STATUSES, ...BLOCKED_STATUSES, ...BACKLOG_STATUSES];

const fetchAllTasks = unstable_cache(
  () => fetchTasksCore(ALL_STATUSES, 'all', 100),
  ['tasks-all'],
  { revalidate: 300 }
);

/**
 * Helper to count tasks by statuses
 */
async function countTasksByStatuses(statuses: string[]): Promise<number> {
  let count = 0;
  for (const status of statuses) {
    const snapshot = await db
      .collection('tasks')
      .where('status', '==', status)
      .count()
      .get();
    count += snapshot.data().count;
  }
  return count;
}

// Cached count fetchers for each status filter
const fetchActiveCount = unstable_cache(
  () => countTasksByStatuses(ACTIVE_STATUSES),
  ['tasks-active-count'],
  { revalidate: 300 }
);

const fetchReviewCount = unstable_cache(
  () => countTasksByStatuses(REVIEW_STATUSES),
  ['tasks-review-count'],
  { revalidate: 300 }
);

const fetchCompletedCount = unstable_cache(
  () => countTasksByStatuses(DONE_STATUSES),
  ['tasks-completed-count'],
  { revalidate: 300 }
);

const fetchBlockedCount = unstable_cache(
  () => countTasksByStatuses(BLOCKED_STATUSES),
  ['tasks-blocked-count'],
  { revalidate: 300 }
);

const fetchBacklogCount = unstable_cache(
  () => countTasksByStatuses(BACKLOG_STATUSES),
  ['tasks-backlog-count'],
  { revalidate: 300 }
);

const fetchAllTasksCount = unstable_cache(
  () => countTasksByStatuses(ALL_STATUSES),
  ['tasks-all-count'],
  { revalidate: 300 }
);

/**
 * Get tasks with filtering, sorting, and pagination.
 * Fetches tasks by status filter, cached separately per filter.
 */
export async function getCachedTasks(options: GetCachedTasksOptions = {}): Promise<GetCachedTasksResult> {
  const {
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    statusFilter = 'active',
    assigneeId,
    limit = 20,
    offset = 0,
  } = options;

  // Fetch tasks and count based on status filter (each cached separately)
  let tasks: TaskWithAssignee[];
  let totalCount: number;

  switch (statusFilter) {
    case 'active': {
      const [data, count] = await Promise.all([fetchActiveTasks(), fetchActiveCount()]);
      tasks = data;
      totalCount = count;
      break;
    }
    case 'review': {
      const [data, count] = await Promise.all([fetchReviewTasks(), fetchReviewCount()]);
      tasks = data;
      totalCount = count;
      break;
    }
    case 'completed': {
      const [data, count] = await Promise.all([fetchCompletedTasks(), fetchCompletedCount()]);
      tasks = data;
      totalCount = count;
      break;
    }
    case 'blocked': {
      const [data, count] = await Promise.all([fetchBlockedTasks(), fetchBlockedCount()]);
      tasks = data;
      totalCount = count;
      break;
    }
    case 'backlog': {
      const [data, count] = await Promise.all([fetchBacklogTasks(), fetchBacklogCount()]);
      tasks = data;
      totalCount = count;
      break;
    }
    case 'overdue': {
      // Fetch overdue tasks with server-side filtering
      const result = await fetchOverdueTasks();
      tasks = result.tasks;
      totalCount = result.count;
      break;
    }
    case 'all':
    default: {
      const [data, count] = await Promise.all([fetchAllTasks(), fetchAllTasksCount()]);
      tasks = data;
      totalCount = count;
      break;
    }
  }

  // Apply assignee filter
  if (assigneeId) {
    tasks = tasks.filter((t) => t.assignee === assigneeId);
  }

  // Sort
  tasks = [...tasks].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortBy) {
      case 'title':
        aVal = a.title?.toLowerCase() || '';
        bVal = b.title?.toLowerCase() || '';
        break;
      case 'status':
        aVal = a.status?.toLowerCase() || '';
        bVal = b.status?.toLowerCase() || '';
        break;
      case 'updatedAt':
        // Use latestActivityAt which includes progress updates
        aVal = a.latestActivityAt || 0;
        bVal = b.latestActivityAt || 0;
        break;
      case 'createdAt':
        aVal = a.createdAt || 0;
        bVal = b.createdAt || 0;
        break;
      case 'percentCompleted':
        aVal = a.percentCompleted ?? 0;
        bVal = b.percentCompleted ?? 0;
        break;
      case 'endsOn':
        aVal = a.endsOn || 0;
        bVal = b.endsOn || 0;
        break;
      default:
        aVal = a.latestActivityAt || 0;
        bVal = b.latestActivityAt || 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Use totalCount from database (accurate even when results are limited)
  // If assigneeId filter is applied, count becomes filtered result length
  const total = assigneeId ? tasks.length : totalCount;

  // Paginate
  const paginatedTasks = tasks.slice(offset, offset + limit);

  return {
    tasks: paginatedTasks,
    total,
    hasMore: offset + paginatedTasks.length < total,
  };
}

/**
 * Get active task count - optimized query that only fetches active tasks
 * Used for dashboard stats without loading all 1000+ tasks
 */
const fetchActiveTaskCount = unstable_cache(
  async (): Promise<number> => {
    console.log('[Cache] Fetching active task count...');
    
    // Query only active status tasks
    let count = 0;
    for (const status of ACTIVE_STATUSES) {
      const snapshot = await db
        .collection('tasks')
        .where('status', '==', status)
        .count()
        .get();
      count += snapshot.data().count;
    }
    
    console.log(`[Cache] Active task count: ${count}`);
    return count;
  },
  ['active-task-count'],
  { revalidate: 300 } // 5 minutes
);

export async function getActiveTaskCount(): Promise<number> {
  return fetchActiveTaskCount();
}

/**
 * Fetch fresh tasks for a specific user, bypassing cache.
 * Used on member detail page to show latest data.
 * @param userId - The user ID to fetch tasks for
 * @param statusFilter - Optional filter: 'active' for in-progress tasks, 'all' for everything
 */
export async function getFreshUserTasks(
  userId: string, 
  statusFilter: 'active' | 'all' = 'active'
): Promise<TaskWithAssignee[]> {
  console.log(`[Tasks] Fetching fresh ${statusFilter} tasks for user ${userId}...`);
  
  // Fetch tasks assigned to this user
  const tasksSnapshot = await db
    .collection('tasks')
    .where('assignee', '==', userId)
    .orderBy('updatedAt', 'desc')
    .limit(100)
    .get();

  let tasks: Task[] = tasksSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as Task));

  // Filter by status if needed
  if (statusFilter === 'active') {
    tasks = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status?.toUpperCase()));
  }

  // Fetch user data for the assignee
  const userDoc = await db.collection('users').doc(userId).get();
  let assigneeUser: TaskWithAssignee['assigneeUser'] = null;
  
  if (userDoc.exists) {
    const data = userDoc.data() as User;
    assigneeUser = {
      id: userDoc.id,
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
      picture: data.picture,
    };
  }

  const tasksWithAssignee: TaskWithAssignee[] = tasks.map((task) => ({
    ...task,
    assigneeUser,
  }));

  console.log(`[Tasks] Fetched ${tasksWithAssignee.length} fresh ${statusFilter} tasks for user ${userId}`);
  return tasksWithAssignee;
}

/**
 * Get task statistics using count queries (efficient, no data transfer)
 */
export async function getTaskStats(): Promise<{
  total: number;
  active: number;
  review: number;
  completed: number;
  blocked: number;
  backlog: number;
}> {
  // Count tasks by status in parallel
  const countByStatuses = async (statuses: string[]): Promise<number> => {
    let count = 0;
    for (const status of statuses) {
      const snapshot = await db
        .collection('tasks')
        .where('status', '==', status)
        .count()
        .get();
      count += snapshot.data().count;
    }
    return count;
  };

  const [active, review, completed, blocked, backlog] = await Promise.all([
    countByStatuses(ACTIVE_STATUSES),
    countByStatuses(REVIEW_STATUSES),
    countByStatuses(DONE_STATUSES),
    countByStatuses(BLOCKED_STATUSES),
    countByStatuses(BACKLOG_STATUSES),
  ]);

  return {
    total: active + review + completed + blocked + backlog,
    active,
    review,
    completed,
    blocked,
    backlog,
  };
}
