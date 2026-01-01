import { unstable_cache } from 'next/cache';
import { db } from './firebase-admin';
import { CACHE_REVALIDATE_SECONDS } from './cache-constants';
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
 * Fetch users directly from Firestore with pagination.
 * Used for simple queries that can be handled by Firestore.
 */
async function fetchUsersPaginated(options: {
  archived: boolean;
  inDiscord?: boolean;
  hideSuperusers?: boolean;
  sortBy: 'created_at' | 'first_name' | 'username' | 'github_id';
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}): Promise<{ users: CachedUser[]; total: number }> {
  const { archived, inDiscord, hideSuperusers, sortBy, sortOrder, limit, offset } = options;

  console.log(`[Cache] Fetching users paginated: archived=${archived}, offset=${offset}, limit=${limit}`);

  // Build base query
  let query = db.collection('users').where('roles.archived', '==', archived);

  // Add inDiscord filter if specified
  if (inDiscord !== undefined) {
    query = query.where('roles.in_discord', '==', inDiscord);
  }

  // Note: hideSuperusers filter must be applied in-memory since Firestore
  // doesn't support != queries combined with other inequality operators well
  
  // Add sorting - Firestore requires the sorted field to exist
  // For created_at, we can sort directly
  if (sortBy === 'created_at') {
    query = query.orderBy('created_at', sortOrder);
  }
  // For other fields, we need to fetch all and sort in memory
  // since Firestore doesn't index these fields reliably

  // Get total count first (separate query)
  let countQuery = db.collection('users').where('roles.archived', '==', archived);
  if (inDiscord !== undefined) {
    countQuery = countQuery.where('roles.in_discord', '==', inDiscord);
  }
  const countSnapshot = await countQuery.count().get();
  let total = countSnapshot.data().count;

  // Fetch paginated results
  // For created_at sorting, use Firestore pagination
  if (sortBy === 'created_at') {
    const paginatedQuery = query.offset(offset).limit(limit);
    const snapshot = await paginatedQuery.get();
    
    let users = snapshot.docs.map((doc) =>
      toMinimalUser({ id: doc.id, ...doc.data() } as User)
    );

    // Apply hideSuperusers filter in memory
    if (hideSuperusers) {
      users = users.filter((u) => !u.roles?.super_user);
      // Adjust total - this is approximate since we can't efficiently count non-superusers
    }

    console.log(`[Cache] Fetched ${users.length} users (total: ${total})`);
    return { users, total };
  }

  // For other sort fields, fetch a reasonable batch and sort in memory
  // This is a fallback - ideally we'd have Firestore indexes for these
  const batchSize = Math.min(500, offset + limit + 100); // Fetch enough to cover pagination
  const snapshot = await query.limit(batchSize).get();
  
  let users = snapshot.docs.map((doc) =>
    toMinimalUser({ id: doc.id, ...doc.data() } as User)
  );

  // Apply hideSuperusers filter
  if (hideSuperusers) {
    users = users.filter((u) => !u.roles?.super_user);
  }

  // Sort in memory
  users.sort((a, b) => {
    let aVal: string = '';
    let bVal: string = '';
    
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
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate
  const paginatedUsers = users.slice(offset, offset + limit);
  
  console.log(`[Cache] Fetched ${paginatedUsers.length} users (total: ${users.length})`);
  return { users: paginatedUsers, total: users.length };
}

/**
 * Fetch all active users - only used for search and activity-based sorting.
 * Cached for 5 minutes.
 */
const fetchAllActiveUsers = unstable_cache(
  async (): Promise<CachedUser[]> => {
    console.log('[Cache] Fetching ALL active users for search/activity sort...');

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
  ['all-active-users-minimal'],
  { revalidate: CACHE_REVALIDATE_SECONDS }
);

/**
 * Fetch all archived users - only used for search within archived.
 * Cached for 5 minutes.
 */
const fetchAllArchivedUsers = unstable_cache(
  async (): Promise<CachedUser[]> => {
    console.log('[Cache] Fetching ALL archived users for search...');

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
  ['all-archived-users-minimal'],
  { revalidate: CACHE_REVALIDATE_SECONDS }
);

/**
 * Get users with filtering, sorting, search, and pagination.
 * 
 * Strategy:
 * - Simple queries (no search, no activity sort): Use Firestore pagination directly
 * - Complex queries (search or activity sort): Load all users, filter/sort in memory
 */
export async function getCachedUsers(options: GetCachedUsersOptions = {}): Promise<GetCachedUsersResult> {
  const {
    sortBy = 'created_at',
    sortOrder = 'desc',
    inDiscord,
    archived = false,
    hideSuperusers,
    limit = 20,
    offset = 0,
    search,
  } = options;

  const isActivitySort = ['lastProgress', 'lastTaskUpdate', 'activeTaskCount'].includes(sortBy);
  const hasSearch = !!(search && search.trim());
  const isSimpleSort = ['created_at', 'first_name', 'username', 'github_id'].includes(sortBy);

  // For simple queries without search or activity sort, use Firestore pagination
  if (!hasSearch && !isActivitySort && isSimpleSort) {
    const { users: paginatedUsers, total } = await fetchUsersPaginated({
      archived,
      inDiscord,
      hideSuperusers,
      sortBy: sortBy as 'created_at' | 'first_name' | 'username' | 'github_id',
      sortOrder,
      limit,
      offset,
    });

    // Fetch activity data only for paginated users
    const activityMap = await fetchActivityForUsers(paginatedUsers.map(u => u.id));

    const usersWithActivity: UserWithActivity[] = paginatedUsers.map((user) => {
      const activity = activityMap.get(user.id) || {
        lastProgress: null,
        lastProgressTaskId: null,
        lastTaskUpdate: null,
        lastTaskUpdateId: null,
        activeTaskCount: 0,
      };
      return {
        ...user,
        ...activity,
      } as UserWithActivity;
    });

    return {
      users: usersWithActivity,
      total,
      hasMore: offset + paginatedUsers.length < total,
    };
  }

  // Complex query: need to load all users for search or activity-based sorting
  let users: CachedUser[];
  
  if (archived) {
    users = await fetchAllArchivedUsers();
  } else {
    users = await fetchAllActiveUsers();
  }

  // Apply search filter (searches name, username, github_id)
  if (hasSearch) {
    const searchLower = search!.toLowerCase().trim();
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
  if (hideSuperusers) {
    users = users.filter((u) => !u.roles?.super_user);
  }

  let sortedUsers: CachedUser[];
  let activityMap: Map<string, ActivityData> | null = null;

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
    // Sort by non-activity fields
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
  const paginatedUsers = sortedUsers.slice(offset, offset + limit);

  // Fetch activity data only for paginated users (if not already fetched)
  if (!activityMap) {
    activityMap = await fetchActivityForUsers(paginatedUsers.map(u => u.id));
  }

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
      ...activity,
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
  { revalidate: CACHE_REVALIDATE_SECONDS }
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
  const users = await fetchAllActiveUsers();
  const map = new Map<string, ActiveUserInfo>();

  users.forEach((user: CachedUser) => {
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
 * Queries Firestore directly with prefix search (requires 3+ characters).
 * Searches by username prefix for efficiency.
 */
export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query || query.trim().length < 3) {
    return [];
  }

  const searchLower = query.toLowerCase().trim();
  const searchUpper = searchLower.slice(0, -1) + String.fromCharCode(searchLower.charCodeAt(searchLower.length - 1) + 1);

  // Query by username prefix (Firestore supports prefix queries)
  // Search both active and archived users in parallel
  const [activeSnapshot, archivedSnapshot] = await Promise.all([
    db.collection('users')
      .where('roles.archived', '==', false)
      .where('username', '>=', searchLower)
      .where('username', '<', searchUpper)
      .limit(10)
      .get(),
    db.collection('users')
      .where('roles.archived', '==', true)
      .where('username', '>=', searchLower)
      .where('username', '<', searchUpper)
      .limit(10)
      .get(),
  ]);

  const mapToSuggestion = (doc: FirebaseFirestore.DocumentSnapshot, isArchived: boolean): SearchSuggestion => {
    const data = doc.data() as User;
    return {
      id: doc.id,
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
      picture: data.picture,
      isArchived,
    };
  };

  const activeMatches = activeSnapshot.docs.map((doc) => mapToSuggestion(doc, false));
  const archivedMatches = archivedSnapshot.docs.map((doc) => mapToSuggestion(doc, true));

  // Combine: active first, then archived, limit to 10
  return [...activeMatches, ...archivedMatches].slice(0, 10);
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
