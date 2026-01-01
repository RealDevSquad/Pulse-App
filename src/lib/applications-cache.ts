import { unstable_cache } from 'next/cache';
import { db } from './firebase-admin';
import { CACHE_REVALIDATE_SECONDS } from './cache-constants';
import type { Application, ApplicationStatus } from '@/types';

export type ApplicationSortField = 'createdAt' | 'biodata.firstName' | 'location.country' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface GetApplicationsOptions {
  status?: ApplicationStatus | 'all';
  sortBy?: ApplicationSortField;
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
}

export interface GetApplicationsResult {
  applications: Application[];
  total: number;
  hasMore: boolean;
}

/**
 * Fetch applications from Firestore with filtering and pagination
 */
async function fetchApplications(options: GetApplicationsOptions): Promise<GetApplicationsResult> {
  const {
    status = 'all',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = 20,
    offset = 0,
  } = options;

  try {
    // Build base query
    let baseQuery: FirebaseFirestore.Query = db.collection('applicants');

    // Apply status filter
    if (status !== 'all') {
      baseQuery = baseQuery.where('status', '==', status);
    }

    // Get total count
    const countSnapshot = await baseQuery.count().get();
    const total = countSnapshot.data().count;

    // Fetch paginated results with sorting
    const fetchLimit = offset + limit;
    const snapshot = await baseQuery
      .orderBy(sortBy, sortOrder)
      .limit(fetchLimit)
      .get();

    // Skip offset items (Firestore doesn't support offset directly for filtered queries)
    const allDocs = snapshot.docs.slice(offset, offset + limit);

    const applications: Application[] = allDocs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Application));

    return {
      applications,
      total,
      hasMore: offset + applications.length < total,
    };
  } catch (error) {
    console.error('Error fetching applications:', error);
    return { applications: [], total: 0, hasMore: false };
  }
}

/**
 * Get cached applications list
 */
export async function getCachedApplications(options: GetApplicationsOptions = {}): Promise<GetApplicationsResult> {
  const cacheKey = `applications-${options.status || 'all'}-${options.sortBy || 'createdAt'}-${options.sortOrder || 'desc'}-${options.limit || 20}-${options.offset || 0}`;

  const cachedFetch = unstable_cache(
    async () => fetchApplications(options),
    [cacheKey],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  );

  return cachedFetch();
}

/**
 * Fetch a single application by ID
 */
async function fetchApplicationById(id: string): Promise<Application | null> {
  try {
    const doc = await db.collection('applicants').doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Application;
  } catch (error) {
    console.error('Error fetching application:', error);
    return null;
  }
}

/**
 * Get cached application by ID
 */
export async function getCachedApplicationById(id: string): Promise<Application | null> {
  const cachedFetch = unstable_cache(
    async () => fetchApplicationById(id),
    [`application-${id}`],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  );

  return cachedFetch();
}

/**
 * Get application counts by status
 */
export async function getApplicationCounts(): Promise<Record<ApplicationStatus | 'all', number>> {
  const cachedFetch = unstable_cache(
    async () => {
      const [totalCount, pendingCount, acceptedCount, rejectedCount] = await Promise.all([
        db.collection('applicants').count().get(),
        db.collection('applicants').where('status', '==', 'pending').count().get(),
        db.collection('applicants').where('status', '==', 'accepted').count().get(),
        db.collection('applicants').where('status', '==', 'rejected').count().get(),
      ]);

      return {
        all: totalCount.data().count,
        pending: pendingCount.data().count,
        accepted: acceptedCount.data().count,
        rejected: rejectedCount.data().count,
      };
    },
    ['application-counts'],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  );

  return cachedFetch();
}
