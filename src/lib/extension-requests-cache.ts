import { cookies } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { db } from './firebase-admin';
import { CACHE_REVALIDATE_SECONDS } from './cache-constants';
import type { ExtensionRequest, ExtensionRequestStatus, User } from '@/types';

export type SortOrder = 'asc' | 'desc';

export interface GetExtensionRequestsOptions {
  status?: ExtensionRequestStatus | 'all';
  taskId?: string;
  assignee?: string;
  sortOrder?: SortOrder;
  size?: number;
  cursor?: string;
}

export interface ExtensionRequestWithUser extends ExtensionRequest {
  assigneeUser?: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    picture?: { url: string };
  };
  taskTitle?: string;
}

export interface GetExtensionRequestsResult {
  extensionRequests: ExtensionRequestWithUser[];
  next?: string;
}

/**
 * Fetch extension requests directly from Firestore
 * Note: We use Firestore directly since the RDS API requires super_user auth
 * and we want to enrich with user data anyway
 */
export async function fetchExtensionRequests(
  options: GetExtensionRequestsOptions = {}
): Promise<GetExtensionRequestsResult> {
  const {
    status = 'all',
    taskId,
    assignee,
    sortOrder = 'desc',
    size = 20,
    cursor,
  } = options;

  try {
    let query: FirebaseFirestore.Query = db.collection('extensionRequests');

    // Apply status filter
    if (status !== 'all') {
      query = query.where('status', '==', status);
    }

    // Apply taskId filter
    if (taskId) {
      query = query.where('taskId', '==', taskId);
    }

    // Apply assignee filter
    if (assignee) {
      query = query.where('assignee', '==', assignee);
    }

    // Order by timestamp
    query = query.orderBy('timestamp', sortOrder);

    // Apply cursor pagination
    if (cursor) {
      const cursorDoc = await db.collection('extensionRequests').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    // Limit results
    query = query.limit(size + 1); // Fetch one extra to check if there's more

    const snapshot = await query.get();
    const docs = snapshot.docs;

    // Check if there's a next page
    const hasMore = docs.length > size;
    const resultDocs = hasMore ? docs.slice(0, size) : docs;

    // Extract extension requests and collect user IDs
    const extensionRequests: ExtensionRequest[] = [];
    const userIds = new Set<string>();
    const taskIds = new Set<string>();

    resultDocs.forEach((doc) => {
      const data = doc.data();
      const assigneeId = data.assignee || data.assigneeId;
      if (assigneeId) {
        userIds.add(assigneeId);
      }
      if (data.taskId) {
        taskIds.add(data.taskId);
      }
      extensionRequests.push({
        id: doc.id,
        taskId: data.taskId,
        title: data.title,
        assignee: assigneeId,
        assigneeId: data.assigneeId,
        oldEndsOn: data.oldEndsOn,
        newEndsOn: data.newEndsOn,
        reason: data.reason,
        status: data.status || 'PENDING',
        requestNumber: data.requestNumber,
        timestamp: data.timestamp?._seconds || data.timestamp,
        reviewedBy: data.reviewedBy,
        reviewedAt: data.reviewedAt,
      });
    });

    // Fetch user details
    const usersMap = new Map<string, User>();
    if (userIds.size > 0) {
      const userIdsArray = Array.from(userIds);
      const batchSize = 30;
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

    // Fetch task titles
    const tasksMap = new Map<string, string>();
    if (taskIds.size > 0) {
      const taskIdsArray = Array.from(taskIds);
      const batchSize = 30;
      for (let i = 0; i < taskIdsArray.length; i += batchSize) {
        const batch = taskIdsArray.slice(i, i + batchSize);
        const tasksSnapshot = await db
          .collection('tasks')
          .where('__name__', 'in', batch)
          .get();

        tasksSnapshot.forEach((doc) => {
          const data = doc.data();
          tasksMap.set(doc.id, data.title || 'Untitled Task');
        });
      }
    }

    // Enrich extension requests with user and task data
    const enrichedRequests: ExtensionRequestWithUser[] = extensionRequests.map((ext) => {
      const user = usersMap.get(ext.assignee);
      return {
        ...ext,
        taskTitle: ext.title || tasksMap.get(ext.taskId) || 'Unknown Task',
        assigneeUser: user
          ? {
              id: user.id,
              username: user.username,
              first_name: user.first_name,
              last_name: user.last_name,
              picture: user.picture,
            }
          : undefined,
      };
    });

    return {
      extensionRequests: enrichedRequests,
      next: hasMore ? resultDocs[resultDocs.length - 1].id : undefined,
    };
  } catch (error) {
    console.error('Error fetching extension requests:', error);
    return { extensionRequests: [] };
  }
}

/**
 * Fetch a single extension request by ID
 */
export async function fetchExtensionRequestById(
  id: string
): Promise<ExtensionRequestWithUser | null> {
  try {
    const doc = await db.collection('extensionRequests').doc(id).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;
    const assigneeId = data.assignee || data.assigneeId;

    // Fetch assignee user
    let assigneeUser: ExtensionRequestWithUser['assigneeUser'];
    if (assigneeId) {
      const userDoc = await db.collection('users').doc(assigneeId).get();
      if (userDoc.exists) {
        const userData = userDoc.data()!;
        assigneeUser = {
          id: userDoc.id,
          username: userData.username,
          first_name: userData.first_name,
          last_name: userData.last_name,
          picture: userData.picture,
        };
      }
    }

    // Fetch task title
    let taskTitle = data.title;
    if (!taskTitle && data.taskId) {
      const taskDoc = await db.collection('tasks').doc(data.taskId).get();
      if (taskDoc.exists) {
        taskTitle = taskDoc.data()?.title || 'Untitled Task';
      }
    }

    return {
      id: doc.id,
      taskId: data.taskId,
      title: data.title,
      taskTitle: taskTitle || 'Unknown Task',
      assignee: assigneeId,
      assigneeId: data.assigneeId,
      oldEndsOn: data.oldEndsOn,
      newEndsOn: data.newEndsOn,
      reason: data.reason,
      status: data.status || 'PENDING',
      requestNumber: data.requestNumber,
      timestamp: data.timestamp?._seconds || data.timestamp,
      reviewedBy: data.reviewedBy,
      reviewedAt: data.reviewedAt,
      assigneeUser,
    };
  } catch (error) {
    console.error('Error fetching extension request:', error);
    return null;
  }
}

/**
 * Get extension request counts by status
 * @param assignee - Optional assignee ID to filter counts for a specific user
 */
export async function getExtensionRequestCounts(
  assignee?: string
): Promise<Record<ExtensionRequestStatus | 'all', number>> {
  // If assignee is provided, calculate counts directly (not cached per-user)
  if (assignee) {
    try {
      const baseQuery = db.collection('extensionRequests').where('assignee', '==', assignee);

      const [totalCount, pendingCount, approvedCount, deniedCount] = await Promise.all([
        baseQuery.count().get(),
        baseQuery.where('status', '==', 'PENDING').count().get(),
        baseQuery.where('status', '==', 'APPROVED').count().get(),
        baseQuery.where('status', '==', 'DENIED').count().get(),
      ]);

      return {
        all: totalCount.data().count,
        PENDING: pendingCount.data().count,
        APPROVED: approvedCount.data().count,
        DENIED: deniedCount.data().count,
      };
    } catch (error) {
      console.error('Error fetching extension request counts for assignee:', error);
      return { all: 0, PENDING: 0, APPROVED: 0, DENIED: 0 };
    }
  }

  // Global counts are cached
  const cachedCounts = unstable_cache(
    async () => {
      try {
        const [totalCount, pendingCount, approvedCount, deniedCount] = await Promise.all([
          db.collection('extensionRequests').count().get(),
          db.collection('extensionRequests').where('status', '==', 'PENDING').count().get(),
          db.collection('extensionRequests').where('status', '==', 'APPROVED').count().get(),
          db.collection('extensionRequests').where('status', '==', 'DENIED').count().get(),
        ]);

        return {
          all: totalCount.data().count,
          PENDING: pendingCount.data().count,
          APPROVED: approvedCount.data().count,
          DENIED: deniedCount.data().count,
        };
      } catch (error) {
        console.error('Error fetching extension request counts:', error);
        return { all: 0, PENDING: 0, APPROVED: 0, DENIED: 0 };
      }
    },
    ['extension-request-counts'],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  );

  return cachedCounts();
}
