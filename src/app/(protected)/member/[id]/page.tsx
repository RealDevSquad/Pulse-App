import { unstable_cache } from 'next/cache';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { getFreshUserTasks } from '@/lib/tasks-cache';
import { getUserActivityFromLogs } from '@/lib/logs-cache';
import { getUserOOOEntries } from '@/lib/ooo-cache';
import { cacheUserActivity, fetchMemberActivityForCache } from '@/lib/users-cache';
import { ArrowLeft, Github, Twitter, Linkedin, Globe, Mail, Phone, TrendingUp, Clock, AlertTriangle, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityCalendar, type ActivityDay, type ActivityEntry, type ActivityItem } from '@/components/activity-calendar';
import Link from 'next/link';
import type { User } from '@/types';

interface DayActivityData {
  task_updates: ActivityEntry[];
  task_assigned: ActivityEntry[];
  task_started: ActivityEntry[];
  task_completed: ActivityEntry[];
  progress_updates: ActivityEntry[];
  task_requests: ActivityEntry[];
  profile_updates: ActivityEntry[];
  extension_requests: ActivityEntry[];
  ooo_entries: ActivityEntry[];
}

interface UserActivityResult {
  activityData: ActivityDay[];
  extendedEndDate: Date | undefined;
}

async function getUserActivityData(userId: string): Promise<UserActivityResult> {
  // Fetch 2 years of data to support year navigation
  const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
  const twoYearsAgoDate = new Date(twoYearsAgo);
  
  // Fetch logs, progress updates, and OOO data in parallel
  const [logsSnapshot, taskAssignmentLogsSnapshot, progressSnapshot, oooEntries] = await Promise.all([
    // Logs for this user (task updates, profile updates, etc.)
    db.collection('logs')
      .where('meta.userId', '==', userId)
      .where('timestamp', '>=', twoYearsAgoDate)
      .orderBy('timestamp', 'desc')
      .get(),
    // Task request approvals where this user was assigned the task
    // Note: meta.userId is the approver, body.approvedTo is the assignee
    db.collection('logs')
      .where('type', '==', 'taskRequests')
      .where('body.approvedTo', '==', userId)
      .where('timestamp', '>=', twoYearsAgoDate)
      .orderBy('timestamp', 'desc')
      .get(),
    // Progress updates by this user
    db.collection('progresses')
      .where('userId', '==', userId)
      .where('createdAt', '>=', twoYearsAgo)
      .get(),
    // OOO entries from cache (aggregates both requests and usersStatus collections)
    getUserOOOEntries(userId),
  ]);

  // Build activity map with detailed entries
  const activityMap = new Map<string, DayActivityData>();

  const getDateKey = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  };

  const ensureDay = (dateKey: string): DayActivityData => {
    if (!activityMap.has(dateKey)) {
      activityMap.set(dateKey, { 
        task_updates: [], 
        task_assigned: [],
        task_started: [],
        task_completed: [],
        progress_updates: [], 
        task_requests: [],
        profile_updates: [],
        extension_requests: [],
        ooo_entries: [],
      });
    }
    return activityMap.get(dateKey)!;
  };

  // First pass: collect all task IDs from logs
  const taskIds = new Set<string>();
  for (const doc of logsSnapshot.docs) {
    const data = doc.data();
    const taskId = data.meta?.taskId;
    if (taskId) taskIds.add(taskId);
  }
  for (const doc of taskAssignmentLogsSnapshot.docs) {
    const data = doc.data();
    const taskId = data.meta?.taskId || data.body?.taskId;
    if (taskId) taskIds.add(taskId);
  }
  
  // Fetch all referenced tasks to get their titles
  const taskTitleMap = new Map<string, string>();
  if (taskIds.size > 0) {
    const taskIdArray = Array.from(taskIds);
    // Firestore 'in' queries support max 30 items, so batch them
    for (let i = 0; i < taskIdArray.length; i += 30) {
      const batch = taskIdArray.slice(i, i + 30);
      const tasksSnapshot = await db.collection('tasks')
        .where('__name__', 'in', batch)
        .get();
      
      for (const taskDoc of tasksSnapshot.docs) {
        const taskData = taskDoc.data();
        taskTitleMap.set(taskDoc.id, taskData.title || 'Untitled task');
      }
    }
  }

  // Track globally which tasks have been seen as started/completed (for deduplication across days)
  // We process logs in descending order (newest first), so we track seen tasks and only show most recent occurrence
  const seenStartedTasks = new Set<string>();
  const seenCompletedTasks = new Set<string>();
  
  // Process logs - collect actual entries with task titles
  for (const doc of logsSnapshot.docs) {
    const data = doc.data();
    const timestamp = data.timestamp?._seconds ? data.timestamp._seconds * 1000 : null;
    if (!timestamp || timestamp < twoYearsAgo) continue;
    
    const dateKey = getDateKey(timestamp);
    const day = ensureDay(dateKey);
    const taskId = data.meta?.taskId;
    
    switch (data.type) {
      case 'task': {
        // Get task title from our map, fallback to log data, then to placeholder
        const taskTitle = (taskId && taskTitleMap.get(taskId)) || 
                          data.body?.taskTitle || 
                          data.meta?.taskTitle || 
                          'Task update';
        const newStatus = data.body?.new?.status;
        const newProgress = data.body?.new?.percentCompleted;
        
        let subtitle = '';
        if (newStatus) subtitle = `Status: ${newStatus.replace('_', ' ')}`;
        else if (newProgress !== undefined) subtitle = `Progress: ${newProgress}%`;
        
        const entry = {
          id: doc.id,
          title: taskTitle,
          subtitle,
          url: taskId ? `/tasks?search=${encodeURIComponent(taskTitle)}` : undefined,
        };
        
        // Separate into started/completed/other updates
        // Deduplicate globally - only show most recent occurrence of each task's start/completion
        if (newStatus === 'IN_PROGRESS') {
          if (taskId && !seenStartedTasks.has(taskId)) {
            seenStartedTasks.add(taskId);
            day.task_started.push(entry);
          } else if (!taskId) {
            day.task_started.push(entry);
          }
        } else if (newStatus === 'COMPLETED' || newStatus === 'DONE' || newStatus === 'VERIFIED') {
          if (taskId && !seenCompletedTasks.has(taskId)) {
            seenCompletedTasks.add(taskId);
            day.task_completed.push(entry);
          } else if (!taskId) {
            day.task_completed.push(entry);
          }
        } else {
          day.task_updates.push(entry);
        }
        break;
      }
      case 'taskRequests': {
        const taskTitle = (taskId && taskTitleMap.get(taskId)) || 
                          data.body?.taskTitle || 
                          data.meta?.taskTitle || 
                          'Task request';
        const status = data.body?.status || 'Pending';
        const approvedTo = data.body?.approvedTo;
        
        // If this is an approval and the task was assigned to THIS user, show as "assigned"
        if (status === 'APPROVED' && approvedTo === userId) {
          const assignedTaskId = data.body?.taskId;
          day.task_assigned.push({
            id: doc.id,
            title: taskTitle,
            subtitle: 'Task assigned',
            url: assignedTaskId ? `/tasks?search=${encodeURIComponent(taskTitle)}` : undefined,
          });
        } else {
          day.task_requests.push({
            id: doc.id,
            title: taskTitle,
            subtitle: `Status: ${status}`,
          });
        }
        break;
      }
      case 'USER_DETAILS_UPDATED':
      case 'PROFILE_VERIFIED': {
        // Extract what fields were updated
        const updatedFields = data.body ? Object.keys(data.body).filter(k => 
          // Filter out internal/timestamp fields to show user-meaningful ones
          !['created_at', 'updated_at', 'github_created_at', 'github_user_id'].includes(k)
        ) : [];
        
        // Format field names nicely
        const formatFieldName = (field: string) => {
          return field
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
        };
        
        let title = 'Profile updated';
        let subtitle = '';
        
        if (data.type === 'PROFILE_VERIFIED') {
          title = 'Profile verified';
        } else if (updatedFields.length > 0) {
          // Show what was updated
          const fieldNames = updatedFields.map(formatFieldName);
          if (fieldNames.length <= 2) {
            title = `Updated ${fieldNames.join(' & ')}`;
          } else {
            title = `Updated ${fieldNames.slice(0, 2).join(', ')} +${fieldNames.length - 2} more`;
          }
          
          // Show the actual values in subtitle (first meaningful value)
          const meaningfulFields = ['first_name', 'last_name', 'username', 'email', 'designation', 'company', 'linkedin_id', 'twitter_id', 'website'];
          for (const field of meaningfulFields) {
            if (data.body[field]) {
              const value = String(data.body[field]);
              subtitle = `${formatFieldName(field)}: ${value.length > 40 ? value.substring(0, 40) + '...' : value}`;
              break;
            }
          }
        }
        
        day.profile_updates.push({
          id: doc.id,
          title,
          subtitle: subtitle || undefined,
        });
        break;
      }
      case 'extensionRequests': {
        // Only count if status is PENDING (user created the request)
        // APPROVED/DENIED means user processed someone else's request as superuser
        const status = data.body?.status;
        if (status !== 'PENDING') break;
        
        const taskTitle = (taskId && taskTitleMap.get(taskId)) || 
                          data.body?.taskTitle || 
                          data.meta?.taskTitle || 
                          'Extension request';
        const oldEndsOn = data.body?.oldEndsOn;
        const newEndsOn = data.body?.newEndsOn;
        let subtitle = '';
        if (oldEndsOn && newEndsOn) {
          const oldDate = new Date(oldEndsOn * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const newDate = new Date(newEndsOn * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          subtitle = `${oldDate} → ${newDate}`;
        }
        day.extension_requests.push({
          id: doc.id,
          title: taskTitle,
          subtitle: subtitle || 'Deadline extension requested',
        });
        break;
      }
    }
  }

  // Process task assignment logs (where body.approvedTo === userId)
  // These are task request approvals where this user was assigned the task
  const seenAssignmentLogIds = new Set<string>();
  for (const doc of logsSnapshot.docs) {
    seenAssignmentLogIds.add(doc.id);
  }
  
  for (const doc of taskAssignmentLogsSnapshot.docs) {
    // Skip if already processed in user's own logs
    if (seenAssignmentLogIds.has(doc.id)) continue;
    
    const data = doc.data();
    const timestamp = data.timestamp?._seconds ? data.timestamp._seconds * 1000 : null;
    if (!timestamp || timestamp < twoYearsAgo) continue;
    
    const status = data.body?.status;
    if (status !== 'APPROVED') continue;
    
    const dateKey = getDateKey(timestamp);
    const day = ensureDay(dateKey);
    const taskId = data.meta?.taskId || data.body?.taskId;
    
    const taskTitle = (taskId && taskTitleMap.get(taskId)) || 
                      data.body?.taskTitle || 
                      data.meta?.taskTitle || 
                      'Task assigned';
    
    day.task_assigned.push({
      id: doc.id,
      title: taskTitle,
      subtitle: 'Task assigned',
      url: taskId ? `/tasks?search=${encodeURIComponent(taskTitle)}` : undefined,
    });
  }

  // Process progress updates - collect actual entries
  for (const doc of progressSnapshot.docs) {
    const data = doc.data();
    const timestamp = data.createdAt || data.date;
    if (timestamp && timestamp >= twoYearsAgo) {
      const dateKey = getDateKey(timestamp);
      const day = ensureDay(dateKey);
      
      // Get progress type and completion status
      const progressType = data.type || 'standup';
      const completed = data.completed;
      const planned = data.planned;
      const blockers = data.blockers;
      
      let subtitle = '';
      if (completed) subtitle = completed.substring(0, 80) + (completed.length > 80 ? '...' : '');
      else if (planned) subtitle = planned.substring(0, 80) + (planned.length > 80 ? '...' : '');
      
      day.progress_updates.push({
        id: doc.id,
        title: progressType === 'standup' ? 'Daily standup' : `Progress: ${progressType}`,
        subtitle: subtitle || (blockers ? 'Has blockers' : undefined),
      });
    }
  }

  // Process OOO from cache (already aggregated from both requests and usersStatus)
  // Include future OOO dates (up to 1 week after the latest OOO end date)
  let latestOOOEnd = Date.now();
  
  for (const entry of oooEntries) {
    if (entry.status === 'APPROVED' || entry.status === 'ACTIVE') {
      const from = entry.from;
      const until = entry.until;
      
      if (from && until) {
        // Track the latest OOO end date for calendar extension
        if (until > latestOOOEnd) {
          latestOOOEnd = until;
        }
        
        // Mark each day in the OOO range with reason (including future dates)
        let current = Math.max(from, twoYearsAgo);
        const end = until; // Don't cap at Date.now() - include future OOO
        
        // Format date range for subtitle
        const fromDate = new Date(from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const untilDate = new Date(until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        while (current <= end) {
          const dateKey = getDateKey(current);
          const day = ensureDay(dateKey);
          
          // Only add if not already added (avoid duplicates from overlapping OOO periods)
          if (!day.ooo_entries.some(e => e.id === entry.id)) {
            day.ooo_entries.push({
              id: entry.id,
              title: entry.reason || 'Out of Office',
              subtitle: `${fromDate} - ${untilDate}`,
            });
          }
          current += 24 * 60 * 60 * 1000; // Next day
        }
      }
    }
  }
  
  // Calculate extended end date: 1 week after the latest OOO end date
  const extendedEndDate = latestOOOEnd > Date.now() 
    ? new Date(latestOOOEnd + 7 * 24 * 60 * 60 * 1000) // 1 week after OOO ends
    : undefined;

  // Convert to ActivityDay array
  const result: ActivityDay[] = [];
  for (const [date, day] of activityMap) {
    const activities: ActivityItem[] = [];
    
    if (day.task_assigned.length > 0) {
      activities.push({ 
        type: 'task_assigned', 
        count: day.task_assigned.length,
        entries: day.task_assigned,
      });
    }
    if (day.task_started.length > 0) {
      activities.push({ 
        type: 'task_started', 
        count: day.task_started.length,
        entries: day.task_started,
      });
    }
    if (day.task_completed.length > 0) {
      activities.push({ 
        type: 'task_completed', 
        count: day.task_completed.length,
        entries: day.task_completed,
      });
    }
    if (day.task_updates.length > 0) {
      activities.push({ 
        type: 'task_update', 
        count: day.task_updates.length,
        entries: day.task_updates,
      });
    }
    if (day.progress_updates.length > 0) {
      activities.push({ 
        type: 'progress', 
        count: day.progress_updates.length,
        entries: day.progress_updates,
      });
    }
    if (day.task_requests.length > 0) {
      activities.push({ 
        type: 'task_request', 
        count: day.task_requests.length,
        entries: day.task_requests,
      });
    }
    if (day.profile_updates.length > 0) {
      activities.push({ 
        type: 'profile_update', 
        count: day.profile_updates.length,
        entries: day.profile_updates,
      });
    }
    if (day.extension_requests.length > 0) {
      activities.push({ 
        type: 'extension_request', 
        count: day.extension_requests.length,
        entries: day.extension_requests,
      });
    }
    if (day.ooo_entries.length > 0) {
      activities.push({ 
        type: 'ooo', 
        count: day.ooo_entries.length,
        entries: day.ooo_entries,
      });
    }
    
    const count = day.task_assigned.length + day.task_started.length + day.task_completed.length + 
                  day.task_updates.length + day.progress_updates.length + 
                  day.task_requests.length + day.profile_updates.length + 
                  day.extension_requests.length + day.ooo_entries.length;
    
    result.push({
      date,
      count,
      activities,
    });
  }

  return { activityData: result, extendedEndDate };
}

/**
 * Cached version of getUserActivityData - 5 min cache per user
 */
function getCachedUserActivityData(userId: string): Promise<UserActivityResult> {
  const cachedFn = unstable_cache(
    async (): Promise<UserActivityResult> => {
      console.log(`[Cache] Fetching activity data for user ${userId}...`);
      return getUserActivityData(userId);
    },
    [`user-activity-${userId}`],
    { revalidate: 300, tags: [`user-activity-${userId}`] }
  );
  return cachedFn();
}

/**
 * Cached user data fetch - 5 min cache per user
 */
function getCachedUser(userId: string): Promise<User | null> {
  const cachedFn = unstable_cache(
    async (): Promise<User | null> => {
      console.log(`[Cache] Fetching user data for ${userId}...`);
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) return null;
      return { id: userDoc.id, ...userDoc.data() } as User;
    },
    [`user-data-${userId}`],
    { revalidate: 300, tags: [`user-data-${userId}`] }
  );
  return cachedFn();
}

interface PageProps {
  params: Promise<{ id: string }>;
}

function getInitials(firstName?: string, lastName?: string, username?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return '??';
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getRoleBadges(roles: User['roles']) {
  const badges: { label: string; className: string }[] = [];
  
  if (roles?.super_user) {
    badges.push({ label: 'Super User', className: 'border-purple-500 text-purple-600 bg-transparent' });
  }
  if (roles?.admin) {
    badges.push({ label: 'Admin', className: 'border-red-500 text-red-600 bg-transparent' });
  }
  if (roles?.member) {
    badges.push({ label: 'Member', className: 'border-green-500 text-green-600 bg-transparent' });
  }
  if (roles?.developer) {
    badges.push({ label: 'Developer', className: 'border-blue-500 text-blue-600 bg-transparent' });
  }
  if (roles?.designer) {
    badges.push({ label: 'Designer', className: 'border-pink-500 text-pink-600 bg-transparent' });
  }
  if (roles?.archived) {
    badges.push({ label: 'Archived', className: 'border-gray-500 text-gray-600 bg-transparent' });
  }
  
  return badges;
}

function getStatusBadge(status?: string) {
  if (!status) return null;
  
  switch (status.toLowerCase()) {
    case 'active':
      return { label: 'Active', className: 'border-green-500 text-green-600 bg-transparent' };
    case 'ooo':
      return { label: 'Out of Office', className: 'border-yellow-500 text-yellow-600 bg-transparent' };
    case 'idle':
      return { label: 'Idle', className: 'border-gray-500 text-gray-600 bg-transparent' };
    default:
      return { label: status, className: 'border-gray-500 text-gray-600 bg-transparent' };
  }
}

export default async function MemberPage({ params }: PageProps) {
  // Access is already checked in layout
  const session = (await getSession())!;
  const { id } = await params;

  // Root check for conditional UI (Member Info section)
  const isRoot = isRootUser(session.userId);

  // Fetch user data from cache
  const user = await getCachedUser(id);
  
  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">404 - Member Not Found</h1>
        <p className="text-muted-foreground">The member you&apos;re looking for doesn&apos;t exist.</p>
        <Button asChild>
          <Link href="/members">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Members
          </Link>
        </Button>
      </div>
    );
  }
  const roleBadges = getRoleBadges(user.roles);
  const statusBadge = getStatusBadge(user.status);

  // Fetch user's tasks (fresh) and activity data from cache
  const [userTasks, activityResult, logsActivity, memberActivityData] = await Promise.all([
    getFreshUserTasks(id),
    getCachedUserActivityData(id),
    getUserActivityFromLogs(id),
    // Fetch the same activity data used by members list to populate LRU cache
    fetchMemberActivityForCache(id),
  ]);
  
  const { activityData, extendedEndDate } = activityResult;

  // Cache this user's activity in LRU cache for the members list page
  // This way, when viewing members list, recently visited profiles have cached activity
  if (memberActivityData) {
    cacheUserActivity(id, {
      ...memberActivityData,
      activeTaskCount: userTasks.length, // Use fresh task count
    });
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/members">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Link>
      </Button>

      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
          <AvatarImage src={user.picture?.url} alt={user.username} />
          <AvatarFallback className="text-xl">
            {getInitials(user.first_name, user.last_name, user.username)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="text-2xl font-bold">
              {user.first_name} {user.last_name}
            </h1>
            <span className="text-muted-foreground">@{user.username}</span>
            {user.designation && (
              <span className="text-sm text-muted-foreground">
                · {user.designation}
                {user.company_name && ` at ${user.company_name}`}
                {!user.company_name && user.company && ` at ${user.company}`}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {statusBadge && (
              <Badge variant="outline" className={statusBadge.className}>
                {statusBadge.label}
              </Badge>
            )}
            {roleBadges.map((badge, i) => (
              <Badge key={i} variant="outline" className={badge.className}>
                {badge.label}
              </Badge>
            ))}
            {user.roles?.in_discord && (
              <Badge variant="outline" className="border-indigo-500 text-indigo-600 bg-transparent">
                In Discord
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Productivity Stats (Last 30 Days) */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            Productivity (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{logsActivity.tasksAssigned}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Assigned</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xl sm:text-2xl font-bold text-emerald-600">{logsActivity.tasksStarted}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Started</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xl sm:text-2xl font-bold text-emerald-600">{logsActivity.tasksCompleted}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xl sm:text-2xl font-bold">{logsActivity.taskUpdates}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Updates</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50 col-span-2 sm:col-span-1">
              <p className={`text-xl sm:text-2xl font-bold ${logsActivity.extensionRequests > 0 ? 'text-red-600' : ''}`}>
                {logsActivity.extensionRequests}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">Extensions</p>
            </div>
          </div>
          {logsActivity.extensionRequests > 2 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start sm:items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
                <span className="text-sm font-medium">This member has requested multiple deadline extensions</span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 ml-6">
                Consider reaching out to see if they need support or if task estimates need adjustment.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Calendar */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            Activity History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <ActivityCalendar data={activityData} showFilters extendedEndDate={extendedEndDate} />
        </CardContent>
      </Card>

      {/* Active Tasks */}
      {userTasks.length > 0 && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Active Tasks ({userTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3">
              {userTasks.map((task) => (
                <a
                  key={task.id}
                  href={`https://status.realdevsquad.com/tasks/${task.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 sm:p-4 rounded-lg border bg-muted/30 space-y-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-foreground line-clamp-2 flex-1 min-w-0 hover:text-primary transition-colors">{task.title}</div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {task.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                  {task.github?.issue?.html_url && (
                    <span className="inline-flex items-center gap-1 text-sm text-blue-600">
                      <Github className="h-3.5 w-3.5" />
                      View on GitHub
                    </span>
                  )}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Member Info (Collapsible) - Root only */}
      {isRoot && (
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <span className="font-semibold">Member Info & Contact</span>
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 sm:mt-4 grid gap-3 sm:gap-6 md:grid-cols-2">
            {/* Contact & Social */}
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Contact & Social</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3">
                {user.github_id && (
                  <a
                    href={`https://github.com/${user.github_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Github className="h-4 w-4" />
                    <span>{user.github_id}</span>
                  </a>
                )}
                {user.twitter_id && (
                  <a
                    href={`https://twitter.com/${user.twitter_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Twitter className="h-4 w-4" />
                    <span>@{user.twitter_id}</span>
                  </a>
                )}
                {user.linkedin_id && (
                  <a
                    href={`https://linkedin.com/in/${user.linkedin_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Linkedin className="h-4 w-4" />
                    <span>{user.linkedin_id}</span>
                  </a>
                )}
                {user.website && (
                  <a
                    href={user.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    <span>{user.website}</span>
                  </a>
                )}
                {user.email && (
                  <a
                    href={`mailto:${user.email}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    <span>{user.email}</span>
                  </a>
                )}
                {user.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{user.phone}</span>
                  </div>
                )}
                {!user.github_id && !user.twitter_id && !user.linkedin_id && !user.website && !user.email && !user.phone && (
                  <p className="text-muted-foreground">No contact information available</p>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Tasks</span>
                  <span className="font-medium">{userTasks.length}</span>
                </div>
                {user.yoe && user.yoe !== '0' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Years of Experience</span>
                    <span className="font-medium">{user.yoe}</span>
                  </div>
                )}
                {user.created_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Joined RDS</span>
                    <span className="font-medium">{formatDate(user.created_at)}</span>
                  </div>
                )}
                {user.discordJoinedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Joined Discord</span>
                    <span className="font-medium">{formatDate(new Date(user.discordJoinedAt).getTime())}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </details>
      )}
    </div>
  );
}
