import { ShieldX } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getUserById, isUserAllowed } from '@/lib/users';
import { getCachedUsers } from '@/lib/users-cache';
import { getCachedOOORequests } from '@/lib/ooo-cache';
import { getCachedTasks } from '@/lib/tasks-cache';
import { getOrgHealthMetrics } from '@/lib/logs-cache';
import { DashboardContent } from './dashboard-content';

export default async function DashboardPage() {
  const session = await getSession();

  // Feature gate: only allowed userIds can access
  if (!session?.userId || !isUserAllowed(session.userId)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <ShieldX className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">403 - Access Denied</h1>
        <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
      </div>
    );
  }

  // Fetch user from Firestore
  const user = await getUserById(session.userId);
  const displayName = user?.first_name || session?.username || 'there';

  // Fetch dashboard stats in parallel
  const [usersResult, oooResult, activeTasksResult, orgHealth] = await Promise.all([
    getCachedUsers({ limit: 1000, hideSuperusers: true }),
    getCachedOOORequests({ limit: 1000 }),
    getCachedTasks({ statusFilter: 'active', limit: 1000 }),
    getOrgHealthMetrics(),
  ]);

  // Count active members (non-archived users with activeTaskCount > 0 or recent activity)
  const activeMembers = usersResult.users.filter(u => u.activeTaskCount > 0).length;

  // Count OOO today (entries where today is between from and until)
  const now = Date.now();
  const oooToday = oooResult.requests.filter(entry => {
    return entry.from <= now && entry.until >= now && (entry.status === 'ACTIVE' || entry.status === 'APPROVED');
  }).length;

  // Count ongoing tasks (active, not done, not backlog)
  const ongoingTasks = activeTasksResult.total;

  return (
    <DashboardContent 
      displayName={displayName}
      activeMembers={activeMembers}
      oooToday={oooToday}
      ongoingTasks={ongoingTasks}
      orgHealth={orgHealth}
    />
  );
}
