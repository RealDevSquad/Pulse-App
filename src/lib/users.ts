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
// - Admin: Any user with roles.super_user === true in Firestore
// - Root: Admin + specifically Ankush's user ID (extra safety for destructive operations)
const ANKUSH_USER_ID = 'XAF7rSUvk4p0d098qWYS';

/**
 * Check if a user has super_user role in Firestore.
 * This is used for admin access checks.
 * Cached to avoid hitting Firestore on every check.
 */
async function checkSuperUserRole(userId: string): Promise<boolean> {
  const cachedCheck = unstable_cache(
    async (uid: string) => {
      try {
        const userDoc = await db.collection('users').doc(uid).get();
        
        if (!userDoc.exists) {
          return false;
        }
        
        const userData = userDoc.data();
        return userData?.roles?.super_user === true;
      } catch (error) {
        console.error('Error checking super_user role:', error);
        return false;
      }
    },
    [`super-user-check-${userId}`],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  );
  
  return cachedCheck(userId);
}

/**
 * Check if a userId is an admin user (any super_user in Firestore).
 * Admins have access to admin features like Task Requests, Extension Requests.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  return checkSuperUserRole(userId);
}

/**
 * Check if a userId is a root user (super_user AND Ankush's specific ID).
 * Root users have access to the most sensitive features like Applications.
 */
export async function isRootUser(userId: string): Promise<boolean> {
  if (userId !== ANKUSH_USER_ID) {
    return false;
  }
  return checkSuperUserRole(userId);
}

/**
 * Check if a userId is allowed to access admin features (same as isAdmin for now)
 */
export async function isUserAllowed(userId: string): Promise<boolean> {
  return isAdminUser(userId);
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
  | { allowed: true; isRoot: boolean; isAdmin: boolean }
  | { allowed: false; reason: 'not_logged_in' | 'not_rds_member' | 'not_authorized' };

/**
 * Check if a user has access to the dashboard.
 * Returns access status, whether the user is root, and whether the user is admin.
 * 
 * Access hierarchy:
 * 1. Must be logged in (have a session)
 * 2. Must be an active RDS member (non-archived)
 * 
 * Any authenticated, non-archived RDS member can access protected pages.
 * Admin users (super_user in Firestore) get access to admin features.
 * Root users (Ankush + super_user) get additional write permissions.
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

  // Check admin and root status in parallel
  const [isAdmin, isRoot] = await Promise.all([
    isAdminUser(userId),
    isRootUser(userId),
  ]);

  return { allowed: true, isRoot, isAdmin };
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
