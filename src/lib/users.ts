import { unstable_cache } from 'next/cache';
import { db } from './firebase-admin';
import { CACHE_REVALIDATE_SECONDS } from './cache-constants';
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

// Access control:
// - Admin: Read-only dashboard access
// - Root: Admin access + Write access (full access)
const ROOT_USER_IDS = ['XAF7rSUvk4p0d098qWYS'];
const ADMIN_USER_IDS: string[] = [];

/**
 * Check if a userId is an admin user (read-only dashboard access)
 */
export function isAdminUser(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

/**
 * Check if a userId is a root user (admin access + write access)
 */
export function isRootUser(userId: string): boolean {
  return ROOT_USER_IDS.includes(userId);
}

/**
 * Check if a userId is allowed to access the dashboard (admin or root)
 */
export function isUserAllowed(userId: string): boolean {
  return isAdminUser(userId) || isRootUser(userId);
}

/**
 * Check if a user is an active RDS member (non-archived)
 * Returns null if user not found, true if active, false if archived
 * Cached for 5 minutes to avoid hitting Firestore on every navigation
 */
export async function isActiveRDSMember(userId: string): Promise<boolean | null> {
  const cachedCheck = unstable_cache(
    async (uid: string) => {
      try {
        const userDoc = await db.collection('users').doc(uid).get();
        
        if (!userDoc.exists) {
          return null; // User not found
        }
        
        const userData = userDoc.data();
        return userData?.roles?.archived !== true;
      } catch (error) {
        console.error('Error checking RDS membership:', error);
        return null;
      }
    },
    [`rds-member-check-${userId}`],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  );
  
  return cachedCheck(userId);
}

export type AccessCheckResult = 
  | { allowed: true; isRoot: boolean }
  | { allowed: false; reason: 'not_logged_in' | 'not_rds_member' | 'not_authorized' };

/**
 * Check if a user has access to the dashboard.
 * Returns access status and whether the user is root.
 * 
 * Access hierarchy:
 * 1. Must be logged in (have a session)
 * 2. Must be an active RDS member (non-archived)
 * 
 * Any authenticated, non-archived RDS member can access protected pages.
 * Root users get additional write permissions.
 */
export async function checkDashboardAccess(userId: string | undefined): Promise<AccessCheckResult> {
  // Check 1: Must be logged in
  if (!userId) {
    return { allowed: false, reason: 'not_logged_in' };
  }

  // Check 2: Must be an active RDS member
  const isActiveMember = await isActiveRDSMember(userId);
  if (isActiveMember === null || isActiveMember === false) {
    return { allowed: false, reason: 'not_rds_member' };
  }

  return { allowed: true, isRoot: isRootUser(userId) };
}

/**
 * Fetch user data from Firestore by userId
 */
export async function getUserById(userId: string): Promise<User | null> {

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
