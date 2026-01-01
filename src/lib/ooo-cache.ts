import { unstable_cache } from 'next/cache';
import { db } from './firebase-admin';
import { getActiveUsersMap } from './users-cache';
import { CACHE_REVALIDATE_SECONDS } from './cache-constants';
import type { OOORequest, UserStatus, User } from '@/types';

export type OOOSource = 'requests' | 'usersStatus';

export interface OOOEntry {
  id: string;
  source: OOOSource;
  userId: string;
  from: number;
  until: number;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE';
  createdAt: number;
  updatedAt: number;
  user: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    picture?: { url: string };
  } | null;
}

export interface FutureStatusEntry {
  id: string;
  userId: string;
  state: string;
  from: number;
  until: number;
  message: string | null;
  requestId: string | null;
  updatedAt: number;
  user: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    picture?: { url: string };
  } | null;
}

export type OOOSortField = 'from' | 'until' | 'createdAt' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface GetOOORequestsOptions {
  sortBy?: OOOSortField;
  sortOrder?: SortOrder;
  showPastRejected?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetOOORequestsResult {
  requests: OOOEntry[];
  total: number;
  hasMore: boolean;
}

/**
 * Fetch all OOO data from both requests and usersStatus collections.
 * Cached for 5 minutes.
 */
const fetchAllOOOData = unstable_cache(
  async (): Promise<OOOEntry[]> => {
    console.log('[Cache] Fetching all OOO data from both sources...');

    const entries: OOOEntry[] = [];

    // 1. Fetch from requests collection
    const requestsSnapshot = await db
      .collection('requests')
      .where('type', '==', 'OOO')
      .get();

    requestsSnapshot.docs.forEach((doc) => {
      const data = doc.data() as Omit<OOORequest, 'id'>;
      entries.push({
        id: doc.id,
        source: 'requests',
        userId: data.requestedBy,
        from: data.from,
        until: data.until,
        reason: data.reason || null,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        user: null,
      });
    });

    // 2. Fetch from usersStatus collection (only OOO status)
    const statusSnapshot = await db
      .collection('usersStatus')
      .where('currentStatus.state', '==', 'OOO')
      .get();

    statusSnapshot.docs.forEach((doc) => {
      const data = doc.data() as Omit<UserStatus, 'id'>;
      const status = data.currentStatus;

      // Skip if no valid date range
      if (!status.from || !status.until || typeof status.until === 'string') {
        return;
      }

      entries.push({
        id: doc.id,
        source: 'usersStatus',
        userId: data.userId,
        from: status.from,
        until: status.until as number,
        reason: status.message || null,
        status: 'ACTIVE', // usersStatus entries are active OOOs
        createdAt: status.updatedAt || status.from,
        updatedAt: status.updatedAt || status.from,
        user: null,
      });
    });

    // 3. Get active users from the shared cache (already filtered: non-archived)
    const activeUsersMap = await getActiveUsersMap();

    // 4. Filter entries to only include active users and attach user data
    const filteredEntries: OOOEntry[] = [];
    entries.forEach((entry) => {
      const userData = activeUsersMap.get(entry.userId);
      if (userData) {
        entry.user = userData;
        filteredEntries.push(entry);
      }
    });

    console.log(`[Cache] Fetched ${filteredEntries.length} OOO entries (filtered from ${entries.length})`);
    return filteredEntries;
  },
  ['ooo-all-data'],
  { revalidate: CACHE_REVALIDATE_SECONDS }
);

/**
 * Get OOO data with filtering, sorting, and pagination.
 * Uses cached data that refreshes every 5 minutes.
 */
export async function getCachedOOORequests(
  options: GetOOORequestsOptions = {}
): Promise<GetOOORequestsResult> {
  const {
    sortBy = 'from',
    sortOrder = 'desc',
    showPastRejected = false,
    limit = 20,
    offset = 0,
  } = options;

  // Get cached data
  let entries = await fetchAllOOOData();

  // By default, show only active/upcoming and non-rejected
  if (!showPastRejected) {
    const now = Date.now();
    entries = entries.filter((e) => {
      // Exclude rejected entries
      if (e.status === 'REJECTED') return false;
      // Only show entries that haven't ended yet (active or upcoming)
      return e.until >= now;
    });
  }

  // Sort
  entries = [...entries].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sortBy) {
      case 'from':
        aVal = a.from;
        bVal = b.from;
        break;
      case 'until':
        aVal = a.until;
        bVal = b.until;
        break;
      case 'createdAt':
        aVal = a.createdAt;
        bVal = b.createdAt;
        break;
      case 'status':
        // Sort by status priority: ACTIVE > PENDING > APPROVED > REJECTED
        const statusOrder = { ACTIVE: 0, PENDING: 1, APPROVED: 2, REJECTED: 3 };
        aVal = statusOrder[a.status] ?? 4;
        bVal = statusOrder[b.status] ?? 4;
        break;
      default:
        aVal = a.from;
        bVal = b.from;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = entries.length;

  // Paginate
  const paginatedEntries = entries.slice(offset, offset + limit);

  return {
    requests: paginatedEntries,
    total,
    hasMore: offset + paginatedEntries.length < total,
  };
}

/**
 * Fetch users with non-empty futureStatus.
 * Cached for 5 minutes.
 */
const fetchFutureStatuses = unstable_cache(
  async (): Promise<FutureStatusEntry[]> => {
    console.log('[Cache] Fetching future statuses...');

    const entries: FutureStatusEntry[] = [];

    // Fetch all usersStatus (Firestore can't query for non-empty objects)
    const snapshot = await db.collection('usersStatus').get();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const futureStatus = data.futureStatus;

      // Check if futureStatus exists and is not empty
      if (futureStatus && typeof futureStatus === 'object' && Object.keys(futureStatus).length > 0) {
        const from = futureStatus.from;
        const rawUntil = futureStatus.endsOn || futureStatus.until;

        // Skip if no from date
        if (!from) {
          return;
        }

        // Handle missing/empty until - treat as indefinite (use a far future date)
        let until: number;
        if (!rawUntil || typeof rawUntil === 'string') {
          // No end date specified - use 1 year from start as placeholder
          until = from + 365 * 24 * 60 * 60 * 1000;
        } else {
          until = rawUntil as number;
        }

        entries.push({
          id: doc.id,
          userId: data.userId,
          state: futureStatus.state || 'UNKNOWN',
          from,
          until,
          message: futureStatus.message || null,
          requestId: futureStatus.requestId || null,
          updatedAt: futureStatus.updatedAt || from,
          user: null,
        });
      }
    });

    // Get active users from the shared cache (already filtered: non-archived)
    const activeUsersMap = await getActiveUsersMap();

    // Filter entries to only include active users and attach user data
    const filteredEntries: FutureStatusEntry[] = [];
    entries.forEach((entry) => {
      const userData = activeUsersMap.get(entry.userId);
      if (userData) {
        entry.user = userData;
        filteredEntries.push(entry);
      }
    });

    // Sort by from date (ascending - upcoming first)
    filteredEntries.sort((a, b) => a.from - b.from);

    console.log(`[Cache] Fetched ${filteredEntries.length} future status entries (filtered from ${entries.length})`);
    return filteredEntries;
  },
  ['future-statuses'],
  { revalidate: CACHE_REVALIDATE_SECONDS }
);

/**
 * Get users with scheduled future statuses.
 */
export async function getCachedFutureStatuses(): Promise<FutureStatusEntry[]> {
  return fetchFutureStatuses();
}

/**
 * Get OOO entries for a specific user.
 * Returns all OOO periods (past and present) for the user.
 */
export async function getUserOOOEntries(userId: string): Promise<OOOEntry[]> {
  const allEntries = await fetchAllOOOData();
  return allEntries.filter(entry => entry.userId === userId);
}

/**
 * Get count of users currently OOO today
 * Optimized query - only counts active OOO entries
 */
const fetchOOOTodayCount = unstable_cache(
  async (): Promise<number> => {
    console.log('[Cache] Fetching OOO today count...');
    const now = Date.now();
    
    // Query requests collection for active/approved OOO covering today
    const requestsSnapshot = await db
      .collection('requests')
      .where('type', '==', 'OOO')
      .where('state', 'in', ['APPROVED'])
      .get();
    
    let count = 0;
    requestsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const from = data.from?._seconds ? data.from._seconds * 1000 : data.from;
      const until = data.until?._seconds ? data.until._seconds * 1000 : data.until;
      if (from <= now && until >= now) {
        count++;
      }
    });
    
    // Also check usersStatus collection
    const statusSnapshot = await db
      .collection('usersStatus')
      .where('currentStatus.state', '==', 'OOO')
      .get();
    
    statusSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const from = data.currentStatus?.from?._seconds 
        ? data.currentStatus.from._seconds * 1000 
        : data.currentStatus?.from;
      const until = data.currentStatus?.until?._seconds 
        ? data.currentStatus.until._seconds * 1000 
        : data.currentStatus?.until;
      if (from && until && from <= now && until >= now) {
        count++;
      }
    });
    
    console.log(`[Cache] OOO today count: ${count}`);
    return count;
  },
  ['ooo-today-count'],
  { revalidate: CACHE_REVALIDATE_SECONDS }
);

export async function getOOOTodayCount(): Promise<number> {
  return fetchOOOTodayCount();
}
