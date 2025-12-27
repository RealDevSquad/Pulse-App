import { getSession } from '@/lib/auth';
import { isUserAllowed } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { getCachedTasks } from '@/lib/tasks-cache';
import { getUserActivityFromLogs } from '@/lib/logs-cache';
import { getUserOOOEntries } from '@/lib/ooo-cache';
import { ShieldX, ArrowLeft, Github, Twitter, Linkedin, Globe, Mail, Phone, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityCalendar, type ActivityDay, type ActivityEntry, type ActivityItem } from '@/components/activity-calendar';
import Link from 'next/link';
import type { User } from '@/types';

interface DayActivityData {
  task_updates: ActivityEntry[];
  progress_updates: ActivityEntry[];
  task_requests: ActivityEntry[];
  profile_updates: ActivityEntry[];
  ooo_entries: ActivityEntry[];
}

async function getUserActivityData(userId: string): Promise<ActivityDay[]> {
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const oneYearAgoDate = new Date(oneYearAgo);
  
  // Fetch logs, progress updates, and OOO data in parallel
  const [logsSnapshot, progressSnapshot, oooEntries] = await Promise.all([
    // Logs for this user (task updates, profile updates, etc.)
    db.collection('logs')
      .where('meta.userId', '==', userId)
      .where('timestamp', '>=', oneYearAgoDate)
      .orderBy('timestamp', 'desc')
      .get(),
    // Progress updates by this user
    db.collection('progresses')
      .where('userId', '==', userId)
      .where('createdAt', '>=', oneYearAgo)
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
        progress_updates: [], 
        task_requests: [],
        profile_updates: [],
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

  // Process logs - collect actual entries with task titles
  for (const doc of logsSnapshot.docs) {
    const data = doc.data();
    const timestamp = data.timestamp?._seconds ? data.timestamp._seconds * 1000 : null;
    if (!timestamp || timestamp < oneYearAgo) continue;
    
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
        
        day.task_updates.push({
          id: doc.id,
          title: taskTitle,
          subtitle,
          url: taskId ? `/tasks?search=${encodeURIComponent(taskTitle)}` : undefined,
        });
        break;
      }
      case 'taskRequests': {
        const taskTitle = (taskId && taskTitleMap.get(taskId)) || 
                          data.body?.taskTitle || 
                          data.meta?.taskTitle || 
                          'Task request';
        const status = data.body?.status || 'Pending';
        day.task_requests.push({
          id: doc.id,
          title: taskTitle,
          subtitle: `Status: ${status}`,
        });
        break;
      }
      case 'USER_DETAILS_UPDATED':
      case 'PROFILE_VERIFIED': {
        day.profile_updates.push({
          id: doc.id,
          title: data.type === 'PROFILE_VERIFIED' ? 'Profile verified' : 'Profile updated',
        });
        break;
      }
    }
  }

  // Process progress updates - collect actual entries
  for (const doc of progressSnapshot.docs) {
    const data = doc.data();
    const timestamp = data.createdAt || data.date;
    if (timestamp && timestamp >= oneYearAgo) {
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
  for (const entry of oooEntries) {
    if (entry.status === 'APPROVED' || entry.status === 'ACTIVE') {
      const from = entry.from;
      const until = entry.until;
      
      if (from && until) {
        // Mark each day in the OOO range with reason
        let current = Math.max(from, oneYearAgo);
        const end = Math.min(until, Date.now());
        
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

  // Convert to ActivityDay array
  const result: ActivityDay[] = [];
  for (const [date, day] of activityMap) {
    const activities: ActivityItem[] = [];
    
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
    if (day.ooo_entries.length > 0) {
      activities.push({ 
        type: 'ooo', 
        count: day.ooo_entries.length,
        entries: day.ooo_entries,
      });
    }
    
    const count = day.task_updates.length + day.progress_updates.length + 
                  day.task_requests.length + day.profile_updates.length + day.ooo_entries.length;
    
    result.push({
      date,
      count,
      activities,
    });
  }

  return result;
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
  switch (status?.toLowerCase()) {
    case 'active':
      return { label: 'Active', className: 'border-green-500 text-green-600 bg-transparent' };
    case 'ooo':
      return { label: 'Out of Office', className: 'border-yellow-500 text-yellow-600 bg-transparent' };
    case 'idle':
      return { label: 'Idle', className: 'border-gray-500 text-gray-600 bg-transparent' };
    default:
      return { label: status || 'Unknown', className: 'border-gray-500 text-gray-600 bg-transparent' };
  }
}

export default async function MemberPage({ params }: PageProps) {
  const session = await getSession();
  const { id } = await params;

  if (!session?.userId || !isUserAllowed(session.userId)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <ShieldX className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">403 - Access Denied</h1>
        <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
      </div>
    );
  }

  // Fetch user data
  const userDoc = await db.collection('users').doc(id).get();
  
  if (!userDoc.exists) {
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

  const user = { id: userDoc.id, ...userDoc.data() } as User;
  const roleBadges = getRoleBadges(user.roles);
  const statusBadge = getStatusBadge(user.status);

  // Fetch user's tasks and activity data in parallel
  const [{ tasks: userTasks }, activityData, logsActivity] = await Promise.all([
    getCachedTasks({
      assigneeId: id,
      limit: 100,
      statusFilter: 'active',
    }),
    getUserActivityData(id),
    getUserActivityFromLogs(id),
  ]);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/members">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Link>
      </Button>

      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
          <AvatarImage src={user.picture?.url} alt={user.username} />
          <AvatarFallback className="text-2xl">
            {getInitials(user.first_name, user.last_name, user.username)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-3">
          <div>
            <h1 className="text-3xl font-bold">
              {user.first_name} {user.last_name}
            </h1>
            <p className="text-lg text-muted-foreground">@{user.username}</p>
          </div>
          
          {user.designation && (
            <p className="text-muted-foreground">
              {user.designation}
              {user.company_name && ` at ${user.company_name}`}
              {!user.company_name && user.company && ` at ${user.company}`}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={statusBadge.className}>
              {statusBadge.label}
            </Badge>
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact & Social */}
        <Card>
          <CardHeader>
            <CardTitle>Contact & Social</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Tasks</span>
              <span className="font-medium">{userTasks.length}</span>
            </div>
            {user.yoe && user.yoe !== '0' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Years of Experience</span>
                <span className="font-medium">{user.yoe}</span>
              </div>
            )}
            {user.created_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined RDS</span>
                <span className="font-medium">{formatDate(user.created_at)}</span>
              </div>
            )}
            {user.discordJoinedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined Discord</span>
                <span className="font-medium">{formatDate(new Date(user.discordJoinedAt).getTime())}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Productivity Stats (Last 30 Days) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Productivity (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{logsActivity.taskUpdates}</p>
              <p className="text-xs text-muted-foreground">Task Updates</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{logsActivity.progressUpdates}</p>
              <p className="text-xs text-muted-foreground">Progress Updates</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-emerald-600">{logsActivity.tasksCompleted}</p>
              <p className="text-xs text-muted-foreground">Tasks Completed</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className={`text-2xl font-bold ${logsActivity.extensionRequests > 2 ? 'text-amber-600' : ''}`}>
                {logsActivity.extensionRequests}
              </p>
              <p className="text-xs text-muted-foreground">Extension Requests</p>
            </div>
          </div>
          {logsActivity.extensionRequests > 2 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">This member has requested multiple deadline extensions</span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Consider reaching out to see if they need support or if task estimates need adjustment.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityCalendar data={activityData} showFilters />
        </CardContent>
      </Card>

      {/* Active Tasks */}
      {userTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Tasks ({userTasks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userTasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium line-clamp-1">{task.title}</div>
                    {task.github?.issue?.html_url && (
                      <a
                        href={task.github.issue.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View on GitHub
                      </a>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {task.status?.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
