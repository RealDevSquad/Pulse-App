import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/users';
import { getActiveMembersCount } from '@/lib/users-cache';
import { getOOOTodayCount } from '@/lib/ooo-cache';
import { getActiveTaskCount } from '@/lib/tasks-cache';
import { getOrgHealthMetrics } from '@/lib/logs-cache';
import { DashboardContent } from './dashboard-content';

export default async function DashboardPage() {
  // Access is already checked in layout - session is guaranteed to exist
  const session = (await getSession())!;

  // Fetch user from Firestore
  const user = await getUserById(session.userId);
  const displayName = user?.first_name || session.username || 'there';

  // Fetch dashboard stats in parallel - using optimized count queries
  const [activeMembers, oooToday, ongoingTasks, orgHealth] = await Promise.all([
    getActiveMembersCount(),
    getOOOTodayCount(),
    getActiveTaskCount(),
    getOrgHealthMetrics(),
  ]);

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
