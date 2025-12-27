import { unstable_cache } from 'next/cache';
import { db } from './firebase-admin';

// Log types from Firestore
export interface LogEntry {
  id: string;
  type: string;
  timestamp: number; // ms since epoch
  body: {
    subType?: string;
    new?: {
      status?: string;
      percentCompleted?: number;
      assignee?: string;
      endsOn?: number;
    };
    oldEndsOn?: number;
    newEndsOn?: number;
    status?: string;
    taskTitle?: string;
    [key: string]: unknown;
  };
  meta: {
    userId?: string;
    username?: string;
    taskId?: string;
    action?: string;
    subAction?: string;
    [key: string]: unknown;
  };
}

export interface MemberProductivity {
  userId: string;
  username: string;
  taskUpdates: number;
  progressUpdates: number;
  extensionRequests: number;
  tasksCompleted: number;
  tasksStarted: number;
}

export interface DailyActivityBreakdown {
  date: string;
  count: number;
  taskUpdates: number;
  taskRequests: number;
  extensionRequests: number;
  approvals: number;
  rejections: number;
}

export interface OrgHealthMetrics {
  // Activity metrics
  totalLogs: number;
  uniqueActiveUsers: number;
  uniqueTasksTouched: number;
  
  // Task flow metrics
  taskStatusUpdates: number;
  tasksStarted: number;
  tasksCompleted: number;
  tasksBlocked: number;
  completionRate: number;
  
  // Request metrics
  taskRequests: number;
  extensionRequests: number;
  approvals: number;
  rejections: number;
  approvalRate: number;
  
  // Daily activity (last 30 days) with breakdown
  dailyActivity: DailyActivityBreakdown[];
  
  // Status change breakdown
  statusChanges: { status: string; count: number }[];
  
  // Member productivity rankings
  topContributors: MemberProductivity[];
  atRiskMembers: MemberProductivity[];
}

export interface UserActivityFromLogs {
  taskUpdates: number;
  progressUpdates: number;
  extensionRequests: number;
  profileUpdates: number;
  taskRequests: number;
  tasksCompleted: number;
  tasksStarted: number;
  dailyActivity: { date: string; count: number; types: string[] }[];
}

/**
 * Fetch recent logs (last 30 days, up to 2000 entries)
 * Cached for 5 minutes
 */
const fetchRecentLogs = unstable_cache(
  async (): Promise<LogEntry[]> => {
    console.log('[Cache] Fetching recent logs...');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const snapshot = await db
      .collection('logs')
      .where('timestamp', '>=', thirtyDaysAgo)
      .orderBy('timestamp', 'desc')
      .limit(2000)
      .get();

    const logs: LogEntry[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type || 'unknown',
        timestamp: data.timestamp?._seconds ? data.timestamp._seconds * 1000 : 0,
        body: data.body || {},
        meta: data.meta || {},
      };
    });

    console.log(`[Cache] Fetched ${logs.length} logs`);
    return logs;
  },
  ['recent-logs'],
  { revalidate: 300 } // 5 minutes
);

/**
 * Get org health metrics from cached logs
 */
export async function getOrgHealthMetrics(): Promise<OrgHealthMetrics> {
  const logs = await fetchRecentLogs();
  
  // Initialize counters
  const uniqueUsers = new Set<string>();
  const uniqueTasks = new Set<string>();
  const dailyActivityMap = new Map<string, DailyActivityBreakdown>();
  const statusChangeMap = new Map<string, number>();
  const memberActivityMap = new Map<string, MemberProductivity>();
  
  const ensureDay = (dateKey: string): DailyActivityBreakdown => {
    if (!dailyActivityMap.has(dateKey)) {
      dailyActivityMap.set(dateKey, {
        date: dateKey,
        count: 0,
        taskUpdates: 0,
        taskRequests: 0,
        extensionRequests: 0,
        approvals: 0,
        rejections: 0,
      });
    }
    return dailyActivityMap.get(dateKey)!;
  };
  
  let taskStatusUpdates = 0;
  let tasksStarted = 0;
  let tasksCompleted = 0;
  let tasksBlocked = 0;
  let taskRequests = 0;
  let extensionRequests = 0;
  let approvals = 0;
  let rejections = 0;

  const getDateKey = (ts: number) => new Date(ts).toISOString().split('T')[0];
  
  const ensureMember = (userId: string, username: string): MemberProductivity => {
    if (!memberActivityMap.has(userId)) {
      memberActivityMap.set(userId, {
        userId,
        username: username || 'unknown',
        taskUpdates: 0,
        progressUpdates: 0,
        extensionRequests: 0,
        tasksCompleted: 0,
        tasksStarted: 0,
      });
    }
    const member = memberActivityMap.get(userId)!;
    if (username && username !== 'unknown') member.username = username;
    return member;
  };

  for (const log of logs) {
    // Track unique users and tasks
    if (log.meta.userId) uniqueUsers.add(log.meta.userId);
    if (log.meta.taskId) uniqueTasks.add(log.meta.taskId);
    
    // Get date key for daily tracking
    const dateKey = log.timestamp ? getDateKey(log.timestamp) : null;
    const day = dateKey ? ensureDay(dateKey) : null;
    if (day) day.count++;
    
    // Get member reference
    const member = log.meta.userId 
      ? ensureMember(log.meta.userId, log.meta.username || '')
      : null;

    switch (log.type) {
      case 'task':
        taskStatusUpdates++;
        if (member) member.taskUpdates++;
        if (day) day.taskUpdates++;
        
        // Track status changes
        const newStatus = log.body?.new?.status;
        if (newStatus) {
          statusChangeMap.set(newStatus, (statusChangeMap.get(newStatus) || 0) + 1);
          
          if (newStatus === 'IN_PROGRESS') {
            tasksStarted++;
            if (member) member.tasksStarted++;
          } else if (newStatus === 'COMPLETED' || newStatus === 'DONE') {
            tasksCompleted++;
            if (member) member.tasksCompleted++;
          } else if (newStatus === 'BLOCKED') {
            tasksBlocked++;
          }
        }
        
        // Track progress updates
        if (log.body?.new?.percentCompleted !== undefined) {
          if (member) member.progressUpdates++;
        }
        break;
        
      case 'taskRequests':
        taskRequests++;
        if (day) day.taskRequests++;
        if (log.body?.status === 'APPROVED' || log.meta.subAction === 'approve') {
          approvals++;
          if (day) day.approvals++;
        } else if (log.body?.status === 'DENIED' || log.meta.subAction === 'reject') {
          rejections++;
          if (day) day.rejections++;
        }
        break;
        
      case 'extensionRequests':
        extensionRequests++;
        if (member) member.extensionRequests++;
        if (day) day.extensionRequests++;
        break;
        
      case 'REQUEST_APPROVED':
        approvals++;
        if (day) day.approvals++;
        break;
        
      case 'REQUEST_REJECTED':
        rejections++;
        if (day) day.rejections++;
        break;
    }
  }

  // Calculate rates
  const completionRate = tasksStarted > 0 
    ? Math.round((tasksCompleted / tasksStarted) * 100) 
    : 0;
  const approvalRate = (approvals + rejections) > 0 
    ? Math.round((approvals / (approvals + rejections)) * 100) 
    : 0;

  // Sort daily activity by date (most recent first)
  const dailyActivity = Array.from(dailyActivityMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  // Sort status changes by count
  const statusChanges = Array.from(statusChangeMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Get top contributors (by task updates + progress updates)
  const topContributors = Array.from(memberActivityMap.values())
    .filter(m => m.taskUpdates > 0 || m.progressUpdates > 0)
    .sort((a, b) => (b.taskUpdates + b.progressUpdates) - (a.taskUpdates + a.progressUpdates))
    .slice(0, 10);

  // Get at-risk members (high extension requests relative to activity)
  const atRiskMembers = Array.from(memberActivityMap.values())
    .filter(m => m.extensionRequests >= 2)
    .sort((a, b) => b.extensionRequests - a.extensionRequests)
    .slice(0, 10);

  return {
    totalLogs: logs.length,
    uniqueActiveUsers: uniqueUsers.size,
    uniqueTasksTouched: uniqueTasks.size,
    taskStatusUpdates,
    tasksStarted,
    tasksCompleted,
    tasksBlocked,
    completionRate,
    taskRequests,
    extensionRequests,
    approvals,
    rejections,
    approvalRate,
    dailyActivity,
    statusChanges,
    topContributors,
    atRiskMembers,
  };
}

/**
 * Get activity data for a specific user from cached logs
 */
export async function getUserActivityFromLogs(userId: string): Promise<UserActivityFromLogs> {
  const logs = await fetchRecentLogs();
  
  const userLogs = logs.filter(log => log.meta.userId === userId);
  
  let taskUpdates = 0;
  let progressUpdates = 0;
  let extensionRequests = 0;
  let profileUpdates = 0;
  let taskRequests = 0;
  let tasksCompleted = 0;
  let tasksStarted = 0;
  
  const dailyMap = new Map<string, { count: number; types: Set<string> }>();
  
  const getDateKey = (ts: number) => new Date(ts).toISOString().split('T')[0];

  for (const log of userLogs) {
    // Track daily activity
    if (log.timestamp) {
      const dateKey = getDateKey(log.timestamp);
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { count: 0, types: new Set() });
      }
      const day = dailyMap.get(dateKey)!;
      day.count++;
      day.types.add(log.type);
    }

    switch (log.type) {
      case 'task':
        taskUpdates++;
        if (log.body?.new?.percentCompleted !== undefined) {
          progressUpdates++;
        }
        if (log.body?.new?.status === 'IN_PROGRESS') {
          tasksStarted++;
        } else if (log.body?.new?.status === 'COMPLETED' || log.body?.new?.status === 'DONE') {
          tasksCompleted++;
        }
        break;
      case 'taskRequests':
        taskRequests++;
        break;
      case 'extensionRequests':
        extensionRequests++;
        break;
      case 'USER_DETAILS_UPDATED':
      case 'PROFILE_VERIFIED':
        profileUpdates++;
        break;
    }
  }

  const dailyActivity = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, count: data.count, types: Array.from(data.types) }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    taskUpdates,
    progressUpdates,
    extensionRequests,
    profileUpdates,
    taskRequests,
    tasksCompleted,
    tasksStarted,
    dailyActivity,
  };
}
