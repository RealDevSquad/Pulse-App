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
 * Fetch all tasks with their assignee data.
 * This is cached for 5 minutes.
 */
const fetchAllTasksWithAssignees = unstable_cache(
  async (): Promise<TaskWithAssignee[]> => {
    console.log('[Cache] Fetching all tasks with assignees...');

    // Fetch all tasks
    const tasksSnapshot = await db
      .collection('tasks')
      .orderBy('updatedAt', 'desc')
      .get();

    const tasks: Task[] = tasksSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Task));

    // Get unique assignee IDs
    const assigneeIds = [...new Set(tasks.map((t) => t.assignee).filter(Boolean))] as string[];

    // Fetch user data for all assignees
    const usersMap = new Map<string, TaskWithAssignee['assigneeUser']>();

    // Process in batches of 30 (Firestore 'in' query limit)
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
    const tasksWithAssignees: TaskWithAssignee[] = tasks.map((task) => ({
      ...task,
      assigneeUser: task.assignee ? usersMap.get(task.assignee) || null : null,
    }));

    console.log(`[Cache] Fetched ${tasksWithAssignees.length} tasks with assignees`);
    return tasksWithAssignees;
  },
  ['tasks-with-assignees'],
  { revalidate: 300 } // 5 minutes
);

/**
 * Get tasks with filtering, sorting, and pagination.
 * Uses cached data that refreshes every 5 minutes.
 */
export async function getCachedTasks(options: GetCachedTasksOptions = {}): Promise<GetCachedTasksResult> {
  const {
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    statusFilter = 'all',
    assigneeId,
    limit = 20,
    offset = 0,
  } = options;

  // Get cached data
  let tasks = await fetchAllTasksWithAssignees();

  // Apply status filter
  if (statusFilter !== 'all') {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    tasks = tasks.filter((t) => {
      const status = t.status?.toUpperCase();
      switch (statusFilter) {
        case 'active':
          return ACTIVE_STATUSES.includes(status);
        case 'review':
          return REVIEW_STATUSES.includes(status);
        case 'completed':
          return DONE_STATUSES.includes(status);
        case 'blocked':
          return BLOCKED_STATUSES.includes(status);
        case 'backlog':
          return BACKLOG_STATUSES.includes(status);
        case 'overdue':
          // Overdue: has assignee, not done/completed, has due date in the past
          if (!t.assignee) return false;
          if (DONE_STATUSES.includes(status)) return false;
          if (!t.endsOn) return false;
          // Handle both seconds and milliseconds
          const endsOnSeconds = t.endsOn > 1e12 ? Math.floor(t.endsOn / 1000) : t.endsOn;
          return endsOnSeconds < now;
        default:
          return true;
      }
    });
  }

  // Apply assignee filter
  if (assigneeId) {
    tasks = tasks.filter((t) => t.assignee === assigneeId);
  }

  // Sort
  tasks = [...tasks].sort((a, b) => {
    let aVal: string | number | null;
    let bVal: string | number | null;

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
        // Handle both updatedAt (seconds) and updated_at (ms)
        aVal = a.updatedAt ? a.updatedAt * 1000 : (a.updated_at || 0);
        bVal = b.updatedAt ? b.updatedAt * 1000 : (b.updated_at || 0);
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
        aVal = a.updatedAt ? a.updatedAt * 1000 : (a.updated_at || 0);
        bVal = b.updatedAt ? b.updatedAt * 1000 : (b.updated_at || 0);
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = tasks.length;

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
 * Get cached user tasks - returns immediately from cache
 * Used for initial page load, then client fetches fresh data
 * 
 * Note: We create a new cached function per userId to enable per-user cache tags
 */
export function getCachedUserTasks(userId: string): Promise<TaskWithAssignee[]> {
  const cachedFn = unstable_cache(
    async (): Promise<TaskWithAssignee[]> => {
      console.log(`[Cache] Fetching tasks for user ${userId}...`);
      return getFreshUserTasks(userId, 'active');
    },
    [`user-tasks-${userId}`],
    { revalidate: 300, tags: [`user-tasks-${userId}`] } // 5 min cache, per-user tag
  );
  return cachedFn();
}

/**
 * Get task statistics
 */
export async function getTaskStats(): Promise<{
  total: number;
  active: number;
  review: number;
  completed: number;
  blocked: number;
  backlog: number;
}> {
  const tasks = await fetchAllTasksWithAssignees();

  return {
    total: tasks.length,
    active: tasks.filter((t) => ACTIVE_STATUSES.includes(t.status?.toUpperCase())).length,
    review: tasks.filter((t) => REVIEW_STATUSES.includes(t.status?.toUpperCase())).length,
    completed: tasks.filter((t) => DONE_STATUSES.includes(t.status?.toUpperCase())).length,
    blocked: tasks.filter((t) => BLOCKED_STATUSES.includes(t.status?.toUpperCase())).length,
    backlog: tasks.filter((t) => BACKLOG_STATUSES.includes(t.status?.toUpperCase())).length,
  };
}
