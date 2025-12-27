import { db } from './firebase-admin';
import type { User } from '@/types';

export type UserSortField = 'username' | 'first_name' | 'github_id' | 'created_at' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface GetUsersOptions {
  limit?: number;
  offset?: number;
  sortBy?: UserSortField;
  sortOrder?: SortOrder;
  inDiscord?: boolean;
  archived?: boolean;
  hideSuperusers?: boolean;
}

export interface GetUsersResult {
  users: User[];
  total: number;
  hasMore: boolean;
}

// Feature gate: only these userIds can access the dashboard
const ALLOWED_USER_IDS = ['XAF7rSUvk4p0d098qWYS'];

/**
 * Check if a userId is allowed to access the dashboard
 */
export function isUserAllowed(userId: string): boolean {
  return ALLOWED_USER_IDS.includes(userId);
}

/**
 * Fetch user data from Firestore by userId
 */
export async function getUserById(userId: string): Promise<User | null> {
  if (!isUserAllowed(userId)) {
    return null;
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return null;
    }

    return {
      id: userDoc.id,
      ...userDoc.data(),
    } as User;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Fetch paginated list of users from Firestore
 */
export async function getUsers(options: GetUsersOptions = {}): Promise<GetUsersResult> {
  const {
    limit = 20,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'desc',
    inDiscord,
    archived,
    hideSuperusers,
  } = options;

  try {
    // Build base query with filters
    let baseQuery: FirebaseFirestore.Query = db.collection('users');

    // Apply filters for roles fields
    if (inDiscord !== undefined) {
      baseQuery = baseQuery.where('roles.in_discord', '==', inDiscord);
    }
    if (archived !== undefined) {
      baseQuery = baseQuery.where('roles.archived', '==', archived);
    }
    if (hideSuperusers) {
      baseQuery = baseQuery.where('roles.super_user', '!=', true);
    }

    // Get total count for filtered results
    const countSnapshot = await baseQuery.count().get();
    const total = countSnapshot.data().count;

    // Fetch paginated users with sorting
    const query = baseQuery
      .orderBy(sortBy, sortOrder)
      .offset(offset)
      .limit(limit);

    const snapshot = await query.get();

    const users: User[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as User));

    return {
      users,
      total,
      hasMore: offset + users.length < total,
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { users: [], total: 0, hasMore: false };
  }
}
