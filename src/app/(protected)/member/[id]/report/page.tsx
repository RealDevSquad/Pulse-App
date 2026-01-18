import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { getFreshUserTasks } from '@/lib/tasks-cache';
import { getUserActivityFromLogs } from '@/lib/logs-cache';
import { calculateMemberMetrics } from '@/lib/member-metrics';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricsCard } from '@/components/member-report/metrics-card';
import { PerformanceMetricsCard } from '@/components/member-report/performance-metrics-card';
import { AIReportSection } from '@/components/member-report/ai-report-section';
import { EnrichmentTimeline } from '@/components/member-report/enrichment-timeline';
import { ExtensionPatternsAnalysis } from '@/components/member-report/extension-patterns-analysis';
import type { User } from '@/types';

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

  return badges;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function MemberReportPage({ params }: PageProps) {
  const [session, { id }] = await Promise.all([getSession(), params]);

  // Check admin (super_user) access
  if (!session?.userId || !(await isAdminUser(session.userId))) {
    redirect('/');
  }

  // Fetch user data and metrics in parallel
  const [userDoc, activeTasks, logsActivity, performanceMetrics] = await Promise.all([
    db.collection('users').doc(id).get(),
    getFreshUserTasks(id),
    getUserActivityFromLogs(id),
    calculateMemberMetrics(id),
  ]);

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
  const memberName = `${user.first_name} ${user.last_name}`.trim() || user.username;
  const roleBadges = getRoleBadges(user.roles);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/member/${id}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-14 w-14 sm:h-20 sm:w-20">
          <AvatarImage src={user.picture?.url} alt={user.username} />
          <AvatarFallback className="text-lg sm:text-xl">
            {getInitials(user.first_name, user.last_name, user.username)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl sm:text-2xl font-bold">Performance Report</h1>
          </div>
          <p className="text-lg">
            {memberName} <span className="text-muted-foreground text-sm">@{user.username}</span>
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {roleBadges.map((badge, i) => (
              <Badge key={i} variant="outline" className={badge.className}>
                {badge.label}
              </Badge>
            ))}
          </div>
          {user.created_at && (
            <p className="text-sm text-muted-foreground mt-1">
              Member since {formatDate(user.created_at)}
            </p>
          )}
        </div>
      </div>

      {/* Performance Metrics - Numerical Scores */}
      <PerformanceMetricsCard metrics={performanceMetrics} />

      {/* 30-Day Activity Counts */}
      <MetricsCard metrics={logsActivity} />

      {/* Active Tasks Summary */}
      {activeTasks.length > 0 && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">
              Active Tasks ({activeTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-2">
              {activeTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 p-2 rounded bg-muted/30"
                >
                  <span className="text-sm truncate flex-1">{task.title}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {task.status?.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
              {activeTasks.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{activeTasks.length - 5} more tasks
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extension Patterns Analysis */}
      <ExtensionPatternsAnalysis userId={id} />

      {/* AI Report Section */}
      <AIReportSection userId={id} />

      {/* Enrichment Timeline */}
      <EnrichmentTimeline targetUserId={id} />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={`/member/${id}/enrich`}>Add Enrichment Note</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/member/${id}`}>View Full Profile</Link>
        </Button>
      </div>
    </div>
  );
}
