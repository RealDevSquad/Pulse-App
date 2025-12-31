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

// ============================================================================
// LRU Activity Cache - Caches activity for last 50 visited member profiles
// ============================================================================

interface ActivityData {
  lastProgress: number | null;
  lastProgressTaskId: string | null;
  lastTaskUpdate: number | null;
  lastTaskUpdateId: string | null;
  activeTaskCount: number;
}

interface CacheEntry {
  data: ActivityData;
  timestamp: number;
}

const ACTIVITY_CACHE_MAX_SIZE = 50;
const ACTIVITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory LRU cache for recently visited user activity
const activityCache = new Map<string, CacheEntry>();

/**
 * Get activity from LRU cache if available and not expired.
 */
function getActivityFromCache(userId: string): ActivityData | null {
  const entry = activityCache.get(userId);
  if (!entry) return null;
  
  // Check if expired
  if (Date.now() - entry.timestamp > ACTIVITY_CACHE_TTL) {
    activityCache.delete(userId);
    return null;
  }
  
  // Move to end (most recently used)
  activityCache.delete(userId);
  activityCache.set(userId, entry);
  
  return entry.data;
}

/**
 * Add activity to LRU cache. Called when a member profile page is visited.
 */
export function cacheUserActivity(userId: string, data: ActivityData): void {
  // Remove oldest entry if at capacity
  if (activityCache.size >= ACTIVITY_CACHE_MAX_SIZE) {
    const oldestKey = activityCache.keys().next().value;
    if (oldestKey) activityCache.delete(oldestKey);
  }
  
  activityCache.set(userId, {
    data,
    timestamp: Date.now(),
  });
  
  console.log(`[ActivityCache] Cached activity for ${userId}. Cache size: ${activityCache.size}`);
}

/**
 * Get all cached user IDs (for debugging/monitoring).
 */
export function getCachedActivityUserIds(): string[] {
  return Array.from(activityCache.keys());
}

// Minimal user data for caching (keeps cache small)
interface CachedUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  github_id: string;
  picture?: { url: string };
  created_at: number;
  roles?: {
    archived?: boolean;
    in_discord?: boolean;
    super_user?: boolean;
    member?: boolean;
    developer?: boolean;
    designer?: boolean;
  };
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
  search?: string;
}

export interface GetCachedUsersResult {
  users: UserWithActivity[];
  total: number;
  hasMore: boolean;
}

/**
 * Fetch activity data for a batch of users.
 * First checks LRU cache for recently visited users, then fetches missing from Firestore.
 */
async function fetchActivityForUsers(userIds: string[]): Promise<Map<string, ActivityData>> {
  const activityMap = new Map<string, ActivityData>();

  if (userIds.length === 0) return activityMap;

  // Check LRU cache first
  const uncachedUserIds: string[] = [];
  let cacheHits = 0;
  
  for (const userId of userIds) {
    const cached = getActivityFromCache(userId);
    if (cached) {
      activityMap.set(userId, cached);
      cacheHits++;
    } else {
      uncachedUserIds.push(userId);
    }
  }
  
  if (cacheHits > 0) {
    console.log(`[ActivityCache] Hit ${cacheHits}/${userIds.length} users from LRU cache`);
  }

  // Fetch uncached users from Firestore
  if (uncachedUserIds.length === 0) return activityMap;

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < uncachedUserIds.length; i += batchSize) {
    const batch = uncachedUserIds.slice(i, i + batchSize);

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

          const activity: ActivityData = {
            lastProgress,
            lastProgressTaskId,
            lastTaskUpdate,
            lastTaskUpdateId,
            activeTaskCount: activeTasksSnapshot.data().count,
          };

          activityMap.set(userId, activity);
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

  return activityMap;
}

/**
 * Extract minimal user data for caching.
 */
function toMinimalUser(user: User): CachedUser {
  return {
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    github_id: user.github_id,
    picture: user.picture,
    created_at: user.created_at,
    roles: user.roles,
  };
}

/**
 * Fetch only active (non-archived) users - minimal data for filtering/sorting.
 * Cached for 5 minutes.
 */
const fetchActiveUsers = unstable_cache(
  async (): Promise<CachedUser[]> => {
    console.log('[Cache] Fetching active users (minimal data)...');

    const usersSnapshot = await db
      .collection('users')
      .where('roles.archived', '==', false)
      .get();
    
    const users = usersSnapshot.docs.map((doc) => 
      toMinimalUser({ id: doc.id, ...doc.data() } as User)
    );

    console.log(`[Cache] Fetched ${users.length} active users`);
    return users;
  },
  ['active-users-minimal'],
  { revalidate: 300 }
);

/**
 * Fetch archived users - minimal data for filtering/sorting.
 * Only loaded when needed (search or archived filter).
 * Cached for 5 minutes.
 */
const fetchArchivedUsers = unstable_cache(
  async (): Promise<CachedUser[]> => {
    console.log('[Cache] Fetching archived users (minimal data)...');

    const usersSnapshot = await db
      .collection('users')
      .where('roles.archived', '==', true)
      .get();
    
    const users = usersSnapshot.docs.map((doc) => 
      toMinimalUser({ id: doc.id, ...doc.data() } as User)
    );

    console.log(`[Cache] Fetched ${users.length} archived users`);
    return users;
  },
  ['archived-users-minimal'],
  { revalidate: 300 }
);

/**
 * Get users with filtering, sorting, search, and pagination.
 * 
 * Strategy:
 * 1. Load minimal user data from cache (small, fits in 2MB)
 * 2. Apply filters, search, and sorting
 * 3. Paginate to get subset
 * 4. Fetch activity data only for the paginated users (not cached)
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
    search,
  } = options;

  // Determine which user sets we need
  const needsArchivedUsers = !!search?.trim() || archived === true;
  
  let users: CachedUser[];
  
  if (needsArchivedUsers) {
    // Load both active and archived users for search or when viewing archived
    const [activeUsers, archivedUsers] = await Promise.all([
      fetchActiveUsers(),
      fetchArchivedUsers(),
    ]);
    users = [...activeUsers, ...archivedUsers];
  } else {
    // Only load active users (default case)
    users = await fetchActiveUsers();
  }

  // Apply search filter first (searches name, username, github_id)
  if (search && search.trim()) {
    const searchLower = search.toLowerCase().trim();
    users = users.filter((u) => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const username = (u.username || '').toLowerCase();
      const githubId = (u.github_id || '').toLowerCase();
      return (
        fullName.includes(searchLower) ||
        username.includes(searchLower) ||
        githubId.includes(searchLower)
      );
    });
  }

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

  // For activity-based sorting, we need to fetch activity for all filtered users
  // This is expensive, so we only do it when sorting by activity fields
  const isActivitySort = ['lastProgress', 'lastTaskUpdate', 'activeTaskCount'].includes(sortBy);
  
  let sortedUsers: CachedUser[];
  let activityMap: Map<string, {
    lastProgress: number | null;
    lastProgressTaskId: string | null;
    lastTaskUpdate: number | null;
    lastTaskUpdateId: string | null;
    activeTaskCount: number;
  }> | null = null;

  if (isActivitySort) {
    // Fetch activity for all filtered users to enable sorting
    activityMap = await fetchActivityForUsers(users.map(u => u.id));
    
    sortedUsers = [...users].sort((a, b) => {
      const aActivity = activityMap!.get(a.id);
      const bActivity = activityMap!.get(b.id);
      
      let aVal: number;
      let bVal: number;

      switch (sortBy) {
        case 'lastProgress':
          aVal = aActivity?.lastProgress || 0;
          bVal = bActivity?.lastProgress || 0;
          break;
        case 'lastTaskUpdate':
          aVal = aActivity?.lastTaskUpdate || 0;
          bVal = bActivity?.lastTaskUpdate || 0;
          break;
        case 'activeTaskCount':
          aVal = aActivity?.activeTaskCount || 0;
          bVal = bActivity?.activeTaskCount || 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  } else {
    // Sort by non-activity fields (no activity fetch needed)
    sortedUsers = [...users].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

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
        default:
          aVal = a.created_at || 0;
          bVal = b.created_at || 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const total = sortedUsers.length;

  // Paginate
  const paginatedUsers = sortedUsers.slice(offset, offset + limit);

  // Fetch activity data only for paginated users (if not already fetched)
  if (!activityMap) {
    activityMap = await fetchActivityForUsers(paginatedUsers.map(u => u.id));
  }

  // Combine paginated users with activity data
  const usersWithActivity: UserWithActivity[] = paginatedUsers.map((user) => {
    const activity = activityMap!.get(user.id) || {
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
    } as UserWithActivity;
  });

  return {
    users: usersWithActivity,
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
  { revalidate: 300 }
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
 */
export async function getActiveUsersMap(): Promise<Map<string, ActiveUserInfo>> {
  const users = await fetchActiveUsers();
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

export interface SearchSuggestion {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  picture?: { url: string };
  isArchived: boolean;
}

/**
 * Get search suggestions for autocomplete.
 * Loads both active and archived users for comprehensive search.
 * Returns up to 10 matching users.
 */
export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  // Load both active and archived users for search suggestions
  const [activeUsers, archivedUsers] = await Promise.all([
    fetchActiveUsers(),
    fetchArchivedUsers(),
  ]);
  const allUsers = [...activeUsers, ...archivedUsers];
  
  const searchLower = query.toLowerCase().trim();

  const matches = allUsers
    .filter((u) => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const username = (u.username || '').toLowerCase();
      const githubId = (u.github_id || '').toLowerCase();
      return (
        fullName.includes(searchLower) ||
        username.includes(searchLower) ||
        githubId.includes(searchLower)
      );
    })
    .slice(0, 10)
    .map((u) => ({
      id: u.id,
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,
      picture: u.picture,
      isArchived: u.roles?.archived || false,
    }));

  return matches;
}

/**
 * Fetch activity data for a single user (for caching when visiting member profile).
 * This fetches the same data used in the members list (lastProgress, lastTaskUpdate).
 */
export async function fetchMemberActivityForCache(userId: string): Promise<Omit<ActivityData, 'activeTaskCount'> | null> {
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

    return {
      lastProgress,
      lastProgressTaskId,
      lastTaskUpdate,
      lastTaskUpdateId,
    };
  } catch (error) {
    console.error(`[Cache] Error fetching activity for user ${userId}:`, error);
    return null;
  }
}
