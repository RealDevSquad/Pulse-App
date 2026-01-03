import { unstable_cache } from 'next/cache';
import { db } from './firebase-admin';
import { CACHE_REVALIDATE_SECONDS } from './cache-constants';
import type { TaskRequest, TaskRequestStatus, TaskRequestType, User } from '@/types';

export type TaskRequestSortField = 'createdAt' | 'usersCount';
export type SortOrder = 'asc' | 'desc';

export interface GetTaskRequestsOptions {
  status?: TaskRequestStatus | 'all';
  requestType?: TaskRequestType | 'all';
  sortBy?: TaskRequestSortField;
  sortOrder?: SortOrder;
  size?: number;
  cursor?: string;
}

export interface TaskRequestWithUsers extends TaskRequest {
  /** Enriched user data for each requestor */
  users: Array<{
    userId: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    picture?: string;
    status: 'PENDING' | 'APPROVED';
    proposedStartDate: number;
    proposedDeadline: number;
    description?: string;
    markdownEnabled?: boolean;
  }>;
}

export interface GetTaskRequestsResult {
  taskRequests: TaskRequestWithUsers[];
  next?: string;
}

/**
 * Fetch task requests directly from Firestore
 */
export async function fetchTaskRequests(
  options: GetTaskRequestsOptions = {}
): Promise<GetTaskRequestsResult> {
  const {
    status = 'all',
    requestType = 'all',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    size = 20,
    cursor,
  } = options;

  try {
    let query: FirebaseFirestore.Query = db.collection('taskRequests');

    // Apply status filter
    if (status !== 'all') {
      query = query.where('status', '==', status);
    }

    // Apply request type filter
    if (requestType !== 'all') {
      query = query.where('requestType', '==', requestType);
    }

    // Order by sort field
    query = query.orderBy(sortBy, sortOrder);

    // Apply cursor pagination
    if (cursor) {
      const cursorDoc = await db.collection('taskRequests').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    // Limit results (fetch one extra to check if there's more)
    query = query.limit(size + 1);

    const snapshot = await query.get();
    const docs = snapshot.docs;

    // Check if there's a next page
    const hasMore = docs.length > size;
    const resultDocs = hasMore ? docs.slice(0, size) : docs;

    // Extract task requests and collect user IDs
    const taskRequests: TaskRequest[] = [];
    const userIds = new Set<string>();

    resultDocs.forEach((doc) => {
      const data = doc.data();
      
      // Collect user IDs from requestors array
      if (data.requestors && Array.isArray(data.requestors)) {
        data.requestors.forEach((userId: string) => userIds.add(userId));
      }
      
      // Also collect from users array
      if (data.users && Array.isArray(data.users)) {
        data.users.forEach((user: { userId: string }) => {
          if (user.userId) userIds.add(user.userId);
        });
      }

      taskRequests.push({
        id: doc.id,
        taskId: data.taskId,
        taskTitle: data.taskTitle || 'Untitled Task',
        externalIssueUrl: data.externalIssueUrl,
        externalIssueHtmlUrl: data.externalIssueHtmlUrl,
        requestType: data.requestType || 'ASSIGNMENT',
        status: data.status || 'PENDING',
        users: data.users || [],
        usersCount: data.usersCount || data.users?.length || data.requestors?.length || 0,
        requestors: data.requestors,
        approvedTo: data.approvedTo,
        createdAt: data.createdAt,
        createdBy: data.createdBy,
        lastModifiedAt: data.lastModifiedAt,
        lastModifiedBy: data.lastModifiedBy,
      });
    });

    // Fetch user details for all requestors
    const usersMap = new Map<string, User>();
    if (userIds.size > 0) {
      const userIdsArray = Array.from(userIds);
      const batchSize = 30; // Firestore 'in' query limit
      
      for (let i = 0; i < userIdsArray.length; i += batchSize) {
        const batch = userIdsArray.slice(i, i + batchSize);
        const usersSnapshot = await db
          .collection('users')
          .where('__name__', 'in', batch)
          .get();

        usersSnapshot.forEach((doc) => {
          usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
        });
      }
    }

    // Enrich task requests with user data
    const enrichedRequests: TaskRequestWithUsers[] = taskRequests.map((request) => {
      const enrichedUsers = (request.users || []).map((user) => {
        const userData = usersMap.get(user.userId);
        return {
          ...user,
          username: userData?.username,
          first_name: userData?.first_name,
          last_name: userData?.last_name,
          picture: userData?.picture?.url,
        };
      });

      return {
        ...request,
        users: enrichedUsers,
      };
    });

    return {
      taskRequests: enrichedRequests,
      next: hasMore ? resultDocs[resultDocs.length - 1].id : undefined,
    };
  } catch (error) {
    console.error('Error fetching task requests:', error);
    return { taskRequests: [] };
  }
}

/**
 * Fetch a single task request by ID
 */
export async function fetchTaskRequestById(id: string): Promise<TaskRequestWithUsers | null> {
  try {
    const doc = await db.collection('taskRequests').doc(id).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;

    // Collect user IDs
    const userIds = new Set<string>();
    if (data.requestors && Array.isArray(data.requestors)) {
      data.requestors.forEach((userId: string) => userIds.add(userId));
    }
    if (data.users && Array.isArray(data.users)) {
      data.users.forEach((user: { userId: string }) => {
        if (user.userId) userIds.add(user.userId);
      });
    }

    // Fetch user details
    const usersMap = new Map<string, User>();
    if (userIds.size > 0) {
      const userIdsArray = Array.from(userIds);
      const usersSnapshot = await db
        .collection('users')
        .where('__name__', 'in', userIdsArray.slice(0, 30))
        .get();

      usersSnapshot.forEach((userDoc) => {
        usersMap.set(userDoc.id, { id: userDoc.id, ...userDoc.data() } as User);
      });
    }

    // Enrich users
    const enrichedUsers = (data.users || []).map((user: { userId: string; status: 'PENDING' | 'APPROVED'; proposedStartDate: number; proposedDeadline: number; description?: string; markdownEnabled?: boolean }) => {
      const userData = usersMap.get(user.userId);
      return {
        ...user,
        username: userData?.username,
        first_name: userData?.first_name,
        last_name: userData?.last_name,
        picture: userData?.picture?.url,
      };
    });

    return {
      id: doc.id,
      taskId: data.taskId,
      taskTitle: data.taskTitle || 'Untitled Task',
      externalIssueUrl: data.externalIssueUrl,
      externalIssueHtmlUrl: data.externalIssueHtmlUrl,
      requestType: data.requestType || 'ASSIGNMENT',
      status: data.status || 'PENDING',
      users: enrichedUsers,
      usersCount: data.usersCount || enrichedUsers.length,
      requestors: data.requestors,
      approvedTo: data.approvedTo,
      createdAt: data.createdAt,
      createdBy: data.createdBy,
      lastModifiedAt: data.lastModifiedAt,
      lastModifiedBy: data.lastModifiedBy,
    };
  } catch (error) {
    console.error('Error fetching task request:', error);
    return null;
  }
}

/**
 * Get task request counts by status
 */
export async function getTaskRequestCounts(): Promise<Record<TaskRequestStatus | 'all', number>> {
  const cachedCounts = unstable_cache(
    async () => {
      try {
        const [totalCount, pendingCount, approvedCount, deniedCount] = await Promise.all([
          db.collection('taskRequests').count().get(),
          db.collection('taskRequests').where('status', '==', 'PENDING').count().get(),
          db.collection('taskRequests').where('status', '==', 'APPROVED').count().get(),
          db.collection('taskRequests').where('status', '==', 'DENIED').count().get(),
        ]);

        return {
          all: totalCount.data().count,
          PENDING: pendingCount.data().count,
          APPROVED: approvedCount.data().count,
          DENIED: deniedCount.data().count,
          WAITING: 0, // Legacy status
        };
      } catch (error) {
        console.error('Error fetching task request counts:', error);
        return { all: 0, PENDING: 0, APPROVED: 0, DENIED: 0, WAITING: 0 };
      }
    },
    ['task-request-counts'],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  );

  return cachedCounts();
}
