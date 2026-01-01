import { db } from './firebase-admin';
import { getLatestProgressForTasks } from './progress-cache';
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
const ALL_STATUSES = [...ACTIVE_STATUSES, ...REVIEW_STATUSES, ...DONE_STATUSES, ...BLOCKED_STATUSES, ...BACKLOG_STATUSES];

// Active work statuses for overdue filtering (excludes backlog/todo)
const ACTIVE_WORK_STATUSES = [...ACTIVE_STATUSES, ...BLOCKED_STATUSES, ...REVIEW_STATUSES];

export interface GetTasksOptions {
  sortBy?: TaskSortField;
  sortOrder?: SortOrder;
  statusFilter?: TaskStatusFilter;
  assigneeId?: string;
  limit?: number;
  offset?: number;
}

export interface GetTasksResult {
  tasks: TaskWithAssignee[];
  total: number;
  hasMore: boolean;
}

/**
 * Fetch all tasks directly from Firestore with pagination (no status filter).
 */
async function fetchAllTasks(options: {
  limit: number;
  offset: number;
}): Promise<{ tasks: TaskWithAssignee[]; total: number }> {
  const { limit, offset } = options;
  
  console.log(`[Firestore] Fetching all tasks (offset=${offset}, limit=${limit})...`);

  // Get total count
  const countSnapshot = await db.collection('tasks').count().get();
  const totalCount = countSnapshot.data().count;

  // Fetch with pagination using offset
  // Firestore doesn't support offset directly, so we need to fetch offset + limit and skip
  const fetchLimit = offset + limit;
  const snapshot = await db
    .collection('tasks')
    .orderBy('updatedAt', 'desc')
    .limit(fetchLimit)
    .get();

  const allTasks: Task[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as Task));

  // Skip offset items
  const paginatedTasks = allTasks.slice(offset, offset + limit);

  if (paginatedTasks.length === 0) {
    return { tasks: [], total: totalCount };
  }

  // Get unique assignee IDs
  const assigneeIds = [...new Set(paginatedTasks.map((t) => t.assignee).filter(Boolean))] as string[];

  // Fetch user data for assignees
  const usersMap = await fetchAssigneeUsers(assigneeIds);

  // Combine tasks with assignee info and latest activity
  const tasksWithAssignees = await addAssigneeInfo(paginatedTasks, usersMap);

  console.log(`[Firestore] Fetched ${tasksWithAssignees.length} tasks (total: ${totalCount})`);
  return { tasks: tasksWithAssignees, total: totalCount };
}

/**
 * Fetch tasks filtered by statuses from Firestore with pagination.
 */
async function fetchTasksByStatuses(options: {
  statuses: string[];
  limit: number;
  offset: number;
}): Promise<{ tasks: TaskWithAssignee[]; total: number }> {
  const { statuses, limit, offset } = options;
  
  console.log(`[Firestore] Fetching tasks by statuses (statuses=${statuses.join(',')}, offset=${offset}, limit=${limit})...`);

  // For single status, use simple query
  if (statuses.length === 1) {
    const status = statuses[0];
    
    // Get count
    const countSnapshot = await db
      .collection('tasks')
      .where('status', '==', status)
      .count()
      .get();
    const totalCount = countSnapshot.data().count;

    // Fetch with pagination
    const fetchLimit = offset + limit;
    const snapshot = await db
      .collection('tasks')
      .where('status', '==', status)
      .orderBy('updatedAt', 'desc')
      .limit(fetchLimit)
      .get();

    const allTasks: Task[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Task));

    const paginatedTasks = allTasks.slice(offset, offset + limit);

    if (paginatedTasks.length === 0) {
      return { tasks: [], total: totalCount };
    }

    const assigneeIds = [...new Set(paginatedTasks.map((t) => t.assignee).filter(Boolean))] as string[];
    const usersMap = await fetchAssigneeUsers(assigneeIds);
    const tasksWithAssignees = await addAssigneeInfo(paginatedTasks, usersMap);

    console.log(`[Firestore] Fetched ${tasksWithAssignees.length} tasks (total: ${totalCount})`);
    return { tasks: tasksWithAssignees, total: totalCount };
  }

  // For multiple statuses, use 'in' query (max 30 values)
  if (statuses.length <= 30) {
    // Get count for each status in parallel
    const countPromises = statuses.map(status => 
      db.collection('tasks').where('status', '==', status).count().get()
    );
    const countSnapshots = await Promise.all(countPromises);
    const totalCount = countSnapshots.reduce((sum, snap) => sum + snap.data().count, 0);

    // Fetch with 'in' query
    const fetchLimit = offset + limit;
    const snapshot = await db
      .collection('tasks')
      .where('status', 'in', statuses)
      .orderBy('updatedAt', 'desc')
      .limit(fetchLimit)
      .get();

    const allTasks: Task[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Task));

    const paginatedTasks = allTasks.slice(offset, offset + limit);

    if (paginatedTasks.length === 0) {
      return { tasks: [], total: totalCount };
    }

    const assigneeIds = [...new Set(paginatedTasks.map((t) => t.assignee).filter(Boolean))] as string[];
    const usersMap = await fetchAssigneeUsers(assigneeIds);
    const tasksWithAssignees = await addAssigneeInfo(paginatedTasks, usersMap);

    console.log(`[Firestore] Fetched ${tasksWithAssignees.length} tasks (total: ${totalCount})`);
    return { tasks: tasksWithAssignees, total: totalCount };
  }

  // Fallback for > 30 statuses (shouldn't happen in practice)
  return fetchAllTasks({ limit, offset });
}

/**
 * Fetch assignee user data in batches.
 */
async function fetchAssigneeUsers(assigneeIds: string[]): Promise<Map<string, TaskWithAssignee['assigneeUser']>> {
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

  return usersMap;
}

/**
 * Add assignee info and latest activity to tasks.
 */
async function addAssigneeInfo(
  tasks: Task[],
  usersMap: Map<string, TaskWithAssignee['assigneeUser']>
): Promise<TaskWithAssignee[]> {
  // Fetch latest progress for all tasks
  const taskIds = tasks.map((t) => t.id);
  const progressMap = await getLatestProgressForTasks(taskIds);
  
  return tasks.map((task) => {
    const updatedAtMs = task.updatedAt ? task.updatedAt * 1000 : 0;
    const updatedAtAltMs = task.updated_at || 0;
    const latestProgressMs = progressMap.get(task.id) || 0;
    
    // Latest activity is the max of all timestamps
    const latestActivityAt = Math.max(updatedAtMs, updatedAtAltMs, latestProgressMs);

    return {
      ...task,
      assigneeUser: task.assignee ? usersMap.get(task.assignee) || null : null,
      latestActivityAt,
    };
  });
}

/**
 * Fetch overdue tasks directly from Firestore with pagination.
 */
async function fetchOverdueTasks(options: {
  limit: number;
  offset: number;
}): Promise<{ tasks: TaskWithAssignee[]; total: number }> {
  const { limit, offset } = options;
  const now = Math.floor(Date.now() / 1000);
  
  console.log(`[Firestore] Fetching overdue tasks (endsOn < ${now}, offset=${offset}, limit=${limit})...`);

  // Fetch enough to cover offset + limit from each status
  const fetchLimit = offset + limit + 20;
  let allOverdueTasks: Task[] = [];

  // Query each active work status for overdue tasks
  for (const status of ACTIVE_WORK_STATUSES) {
    const snapshot = await db
      .collection('tasks')
      .where('status', '==', status)
      .where('endsOn', '<', now)
      .orderBy('endsOn', 'asc')
      .limit(fetchLimit)
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

  // Sort by endsOn asc (most overdue first)
  allOverdueTasks.sort((a, b) => (a.endsOn || 0) - (b.endsOn || 0));

  const total = allOverdueTasks.length;

  // Paginate
  const paginatedTasks = allOverdueTasks.slice(offset, offset + limit);

  if (paginatedTasks.length === 0) {
    return { tasks: [], total };
  }

  // Get unique assignee IDs and fetch user data
  const assigneeIds = [...new Set(paginatedTasks.map((t) => t.assignee).filter(Boolean))] as string[];
  const usersMap = await fetchAssigneeUsers(assigneeIds);
  const tasksWithAssignees = await addAssigneeInfo(paginatedTasks, usersMap);

  console.log(`[Firestore] Fetched ${tasksWithAssignees.length} overdue tasks (total: ${total})`);
  return { tasks: tasksWithAssignees, total };
}

/**
 * Get tasks with filtering, sorting, and pagination.
 * Fetches directly from Firestore.
 */
export async function getTasks(options: GetTasksOptions = {}): Promise<GetTasksResult> {
  const {
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    statusFilter = 'active',
    assigneeId,
    limit = 20,
    offset = 0,
  } = options;

  let result: { tasks: TaskWithAssignee[]; total: number };

  // Handle different status filters
  switch (statusFilter) {
    case 'all':
      // For "all", fetch without status filter - much faster
      result = await fetchAllTasks({ limit, offset });
      break;
    case 'active':
      result = await fetchTasksByStatuses({ statuses: ACTIVE_STATUSES, limit, offset });
      break;
    case 'review':
      result = await fetchTasksByStatuses({ statuses: REVIEW_STATUSES, limit, offset });
      break;
    case 'completed':
      result = await fetchTasksByStatuses({ statuses: DONE_STATUSES, limit, offset });
      break;
    case 'blocked':
      result = await fetchTasksByStatuses({ statuses: BLOCKED_STATUSES, limit, offset });
      break;
    case 'backlog':
      result = await fetchTasksByStatuses({ statuses: BACKLOG_STATUSES, limit, offset });
      break;
    case 'overdue': {
      const overdueResult = await fetchOverdueTasks({ limit, offset });
      return {
        tasks: overdueResult.tasks,
        total: overdueResult.total,
        hasMore: offset + overdueResult.tasks.length < overdueResult.total,
      };
    }
    default:
      result = await fetchAllTasks({ limit, offset });
      break;
  }
  
  // Apply assignee filter if needed
  let tasks = result.tasks;
  let total = result.total;
  
  if (assigneeId) {
    tasks = tasks.filter((t: TaskWithAssignee) => t.assignee === assigneeId);
    total = tasks.length;
  }

  // Sort if needed (results come sorted by updatedAt desc by default)
  if (sortBy !== 'updatedAt' || sortOrder !== 'desc') {
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
  }

  return {
    tasks,
    total,
    hasMore: offset + tasks.length < total,
  };
}

/**
 * Get count of active tasks
 */
export async function getActiveTaskCount(): Promise<number> {
  let count = 0;
  for (const status of ACTIVE_STATUSES) {
    const snapshot = await db
      .collection('tasks')
      .where('status', '==', status)
      .count()
      .get();
    count += snapshot.data().count;
  }
  return count;
}

/**
 * Get count of overdue tasks
 */
export async function getOverdueTaskCount(): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  let count = 0;
  
  for (const status of ACTIVE_WORK_STATUSES) {
    const snapshot = await db
      .collection('tasks')
      .where('status', '==', status)
      .where('endsOn', '<', now)
      .count()
      .get();
    count += snapshot.data().count;
  }
  return count;
}

/**
 * Fetch fresh tasks for a specific user.
 */
export async function getFreshUserTasks(
  userId: string, 
  statusFilter: 'active' | 'all' = 'active'
): Promise<TaskWithAssignee[]> {
  console.log(`[Firestore] Fetching ${statusFilter} tasks for user ${userId}...`);
  
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

  if (statusFilter === 'active') {
    tasks = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status?.toUpperCase()));
  }

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
    latestActivityAt: task.updatedAt ? task.updatedAt * 1000 : 0,
  }));

  console.log(`[Firestore] Fetched ${tasksWithAssignee.length} ${statusFilter} tasks for user ${userId}`);
  return tasksWithAssignee;
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

// Backwards compatibility aliases
export const getCachedTasks = getTasks;
export type { GetTasksOptions as GetCachedTasksOptions, GetTasksResult as GetCachedTasksResult };
