import { unstable_cache } from 'next/cache';
import { db } from './firebase-admin';
import type { User } from '@/types';

export interface UserWithActivity extends User {
  lastProgress: number | null;
  lastProgressTaskId: string | null;
  lastTaskUpdate: number | null;
  lastTaskUpdateId: string | null;
  activeTaskCount: number;
}

export type UserSortField = 'username' | 'first_name' | 'github_id' | 'created_at' | 'lastProgress' | 'lastTaskUpdate' | 'activeTaskCount';
export type SortOrder = 'asc' | 'desc';

export interface GetCachedUsersOptions {
  sortBy?: UserSortField;
  sortOrder?: SortOrder;
  inDiscord?: boolean;
  archived?: boolean;
  hideSuperusers?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetCachedUsersResult {
  users: UserWithActivity[];
  total: number;
  hasMore: boolean;
}

/**
 * Fetch all users with their task activity data.
 * This is cached for 5 minutes.
 */
const fetchAllUsersWithActivity = unstable_cache(
  async (): Promise<UserWithActivity[]> => {
    console.log('[Cache] Fetching all active users with activity...');

    // Fetch only non-archived users
    const usersSnapshot = await db
      .collection('users')
      .where('roles.archived', '==', false)
      .get();
    const users: User[] = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as User));

    // Fetch task activity for all users in parallel (batch of 50)
    const userIds = users.map((u) => u.id);
    const activityMap = new Map<string, {
      lastProgress: number | null;
      lastProgressTaskId: string | null;
      lastTaskUpdate: number | null;
      lastTaskUpdateId: string | null;
      activeTaskCount: number;
    }>();

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (userId) => {
          try {
            // Get user's most recent progress update
            const progressSnapshot = await db
              .collection('progresses')
              .where('userId', '==', userId)
              .orderBy('createdAt', 'desc')
              .limit(1)
              .get();

            // Get user's most recently updated task
            const taskUpdateSnapshot = await db
              .collection('tasks')
              .where('assignee', '==', userId)
              .orderBy('updatedAt', 'desc')
              .limit(1)
              .get();

            // Count active tasks
            const activeTasksSnapshot = await db
              .collection('tasks')
              .where('assignee', '==', userId)
              .where('status', 'in', ['ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'NEEDS_REVIEW'])
              .count()
              .get();

            const progressDoc = progressSnapshot.docs[0];
            const progressData = progressDoc?.data();
            const taskDoc = taskUpdateSnapshot.docs[0];
            const taskData = taskDoc?.data();

            // Progress createdAt is in ms
            const lastProgress = progressData?.createdAt ?? null;
            const lastProgressTaskId = progressData?.taskId ?? null;

            // Task updatedAt is in seconds, convert to ms
            const lastTaskUpdate = taskData?.updatedAt
              ? taskData.updatedAt * 1000
              : null;
            const lastTaskUpdateId = taskDoc?.id ?? null;

            activityMap.set(userId, {
              lastProgress,
              lastProgressTaskId,
              lastTaskUpdate,
              lastTaskUpdateId,
              activeTaskCount: activeTasksSnapshot.data().count,
            });
          } catch (error) {
            console.error(`[Cache] Error fetching activity for user ${userId}:`, error);
            activityMap.set(userId, {
              lastProgress: null,
              lastProgressTaskId: null,
              lastTaskUpdate: null,
              lastTaskUpdateId: null,
              activeTaskCount: 0,
            });
          }
        })
      );
    }

    // Combine users with activity
    const usersWithActivity: UserWithActivity[] = users.map((user) => {
      const activity = activityMap.get(user.id) || {
        lastProgress: null,
        lastProgressTaskId: null,
        lastTaskUpdate: null,
        lastTaskUpdateId: null,
        activeTaskCount: 0,
      };
      return {
        ...user,
        lastProgress: activity.lastProgress,
        lastProgressTaskId: activity.lastProgressTaskId,
        lastTaskUpdate: activity.lastTaskUpdate,
        lastTaskUpdateId: activity.lastTaskUpdateId,
        activeTaskCount: activity.activeTaskCount,
      };
    });

    console.log(`[Cache] Fetched ${usersWithActivity.length} users with activity`);
    return usersWithActivity;
  },
  ['users-with-activity'],
  { revalidate: 300 } // 5 minutes
);

/**
 * Get users with filtering, sorting, and pagination.
 * Uses cached data that refreshes every 5 minutes.
 */
export async function getCachedUsers(options: GetCachedUsersOptions = {}): Promise<GetCachedUsersResult> {
  const {
    sortBy = 'created_at',
    sortOrder = 'desc',
    inDiscord,
    archived,
    hideSuperusers,
    limit = 20,
    offset = 0,
  } = options;

  // Get cached data
  let users = await fetchAllUsersWithActivity();

  // Apply filters
  if (inDiscord !== undefined) {
    users = users.filter((u) => u.roles?.in_discord === inDiscord);
  }
  if (archived !== undefined) {
    users = users.filter((u) => u.roles?.archived === archived);
  }
  if (hideSuperusers) {
    users = users.filter((u) => !u.roles?.super_user);
  }

  // Sort
  users = [...users].sort((a, b) => {
    let aVal: string | number | null;
    let bVal: string | number | null;

    switch (sortBy) {
      case 'first_name':
        aVal = a.first_name?.toLowerCase() || '';
        bVal = b.first_name?.toLowerCase() || '';
        break;
      case 'username':
        aVal = a.username?.toLowerCase() || '';
        bVal = b.username?.toLowerCase() || '';
        break;
      case 'github_id':
        aVal = a.github_id?.toLowerCase() || '';
        bVal = b.github_id?.toLowerCase() || '';
        break;
      case 'created_at':
        aVal = a.created_at || 0;
        bVal = b.created_at || 0;
        break;
      case 'lastProgress':
        aVal = a.lastProgress || 0;
        bVal = b.lastProgress || 0;
        break;
      case 'lastTaskUpdate':
        aVal = a.lastTaskUpdate || 0;
        bVal = b.lastTaskUpdate || 0;
        break;
      case 'activeTaskCount':
        aVal = a.activeTaskCount || 0;
        bVal = b.activeTaskCount || 0;
        break;
      default:
        aVal = a.created_at || 0;
        bVal = b.created_at || 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = users.length;

  // Paginate
  const paginatedUsers = users.slice(offset, offset + limit);

  return {
    users: paginatedUsers,
    total,
    hasMore: offset + paginatedUsers.length < total,
  };
}

/**
 * Get count of active members (users with at least one active task)
 * Optimized to avoid fetching all user data
 */
const fetchActiveMembersCount = unstable_cache(
  async (): Promise<number> => {
    console.log('[Cache] Fetching active members count...');
    
    // Get all assigned tasks with active status
    const activeStatuses = ['ASSIGNED', 'IN_PROGRESS'];
    const assigneeSet = new Set<string>();
    
    for (const status of activeStatuses) {
      const snapshot = await db
        .collection('tasks')
        .where('status', '==', status)
        .select('assignee')
        .get();
      
      snapshot.docs.forEach(doc => {
        const assignee = doc.data().assignee;
        if (assignee) assigneeSet.add(assignee);
      });
    }
    
    console.log(`[Cache] Active members count: ${assigneeSet.size}`);
    return assigneeSet.size;
  },
  ['active-members-count'],
  { revalidate: 300 } // 5 minutes
);

export async function getActiveMembersCount(): Promise<number> {
  return fetchActiveMembersCount();
}

export interface ActiveUserInfo {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  picture?: { url: string };
}

/**
 * Get a map of active (non-archived) user IDs to their basic info.
 * Uses the same cached data as getCachedUsers.
 */
export async function getActiveUsersMap(): Promise<Map<string, ActiveUserInfo>> {
  const users = await fetchAllUsersWithActivity();
  const map = new Map<string, ActiveUserInfo>();

  users.forEach((user) => {
    map.set(user.id, {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      picture: user.picture,
    });
  });

  return map;
}
