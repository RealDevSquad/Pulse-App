'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, ListTodo, TrendingUp, CheckCircle2, AlertTriangle, Activity, ListChecks, CalendarPlus, Clock } from 'lucide-react';
import { FolderOpenIcon } from '@/components/ui/folder-open';
import { StaggerContainer, StaggerItem, HoverLift, FadeIn } from '@/components/ui/motion';
import type { OrgHealthMetrics, DailyActivityBreakdown } from '@/lib/logs-cache';

interface DashboardContentProps {
  displayName: string;
  activeMembers: number;
  oooToday: number;
  ongoingTasks: number;
  orgHealth: OrgHealthMetrics;
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function ActivityDetailPanel({ day, onClose }: { day: DailyActivityBreakdown; onClose: () => void }) {
  const details = [
    { 
      icon: ListChecks, 
      label: 'task update', 
      count: day.taskUpdates,
      description: 'Status changes, progress percentage updates, or deadline modifications',
      color: 'text-blue-600'
    },
    { 
      icon: CalendarPlus, 
      label: 'task request', 
      count: day.taskRequests,
      description: 'Requested to work on new tasks',
      color: 'text-purple-600'
    },
    { 
      icon: Clock, 
      label: 'extension request', 
      count: day.extensionRequests,
      description: 'Requested deadline extensions',
      color: 'text-amber-600'
    },
  ].filter(d => d.count > 0);

  return (
    <div 
      className="absolute right-0 top-0 w-72 bg-background border rounded-lg shadow-lg p-4 z-10"
      onMouseLeave={onClose}
    >
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold">{formatDateDisplay(day.date)}</h4>
          <p className="text-sm text-muted-foreground">{day.count} activities</p>
        </div>
        
        {details.length > 0 ? (
          <div className="space-y-3">
            {details.map((detail) => (
              <div key={detail.label} className="flex gap-3 p-2 rounded-lg border bg-muted/30">
                <detail.icon className={`h-5 w-5 ${detail.color} shrink-0 mt-0.5`} />
                <div>
                  <p className="font-medium text-sm">
                    {detail.count} {detail.label}{detail.count !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">{detail.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No activity on this day</p>
        )}
      </div>
    </div>
  );
}

function ActivityHeatmap({ dailyActivity }: { dailyActivity: DailyActivityBreakdown[] }) {
  const [hoveredDay, setHoveredDay] = useState<DailyActivityBreakdown | null>(null);
  const [pinnedDay, setPinnedDay] = useState<DailyActivityBreakdown | null>(null);
  
  // Create a map for quick lookup
  const activityMap = new Map(dailyActivity.map(d => [d.date, d]));
  
  // Generate last 30 days
  const emptyDay: Omit<DailyActivityBreakdown, 'date'> = {
    count: 0,
    taskUpdates: 0,
    taskRequests: 0,
    extensionRequests: 0,
    approvals: 0,
    rejections: 0,
  };
  
  const days: DailyActivityBreakdown[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    days.push(activityMap.get(dateStr) || { date: dateStr, ...emptyDay });
  }

  const maxCount = Math.max(...days.map(d => d.count), 1);

  const getIntensityClass = (count: number) => {
    if (count === 0) return 'bg-muted';
    const ratio = count / maxCount;
    if (ratio < 0.25) return 'bg-emerald-200 dark:bg-emerald-900';
    if (ratio < 0.5) return 'bg-emerald-300 dark:bg-emerald-700';
    if (ratio < 0.75) return 'bg-emerald-400 dark:bg-emerald-600';
    return 'bg-emerald-500 dark:bg-emerald-500';
  };

  const activeDay = pinnedDay || hoveredDay;

  const handleDayClick = (day: DailyActivityBreakdown) => {
    if (pinnedDay?.date === day.date) {
      setPinnedDay(null);
    } else {
      setPinnedDay(day);
    }
  };

  const handleClose = () => {
    if (!pinnedDay) {
      setHoveredDay(null);
    }
  };

  return (
    <div className="space-y-2 relative">
      <div className="flex gap-4">
        <div className="flex gap-1 flex-wrap flex-1">
          {days.map((day) => (
            <div
              key={day.date}
              className={`w-4 h-4 rounded-sm cursor-pointer transition-all ${getIntensityClass(day.count)} ${
                activeDay?.date === day.date ? 'ring-2 ring-foreground ring-offset-1' : 'hover:ring-2 hover:ring-muted-foreground hover:ring-offset-1'
              }`}
              onMouseEnter={() => !pinnedDay && setHoveredDay(day)}
              onMouseLeave={() => !pinnedDay && setHoveredDay(null)}
              onClick={() => handleDayClick(day)}
            />
          ))}
        </div>
        
        {activeDay && (
          <ActivityDetailPanel 
            day={activeDay} 
            onClose={handleClose}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>30 days ago</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm bg-muted" />
            <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
            <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-600" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          </div>
          <span>More</span>
        </div>
        <span>Today</span>
      </div>
    </div>
  );
}

export function DashboardContent({ displayName, activeMembers, oooToday, ongoingTasks, orgHealth }: DashboardContentProps) {
  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <FadeIn>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Hello, {displayName}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Here&apos;s what&apos;s happening with your team today
          </p>
        </div>
      </FadeIn>

      {/* Primary Metrics Cards */}
      <StaggerContainer className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <Link href="/members">
            <HoverLift>
              <Card className="cursor-pointer bg-gradient-to-br from-emerald-50 to-white border-emerald-100 dark:from-emerald-950/20 dark:to-background">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Active Members</CardTitle>
                  <div className="rounded-full bg-emerald-500/10 p-1.5 sm:p-2">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-2xl sm:text-3xl font-bold">{activeMembers}</div>
                </CardContent>
              </Card>
            </HoverLift>
          </Link>
        </StaggerItem>

        <StaggerItem>
          <Link href="/ooo">
            <HoverLift>
              <Card className="cursor-pointer bg-gradient-to-br from-blue-50 to-white border-blue-100 dark:from-blue-950/20 dark:to-background">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">OOO Today</CardTitle>
                  <div className="rounded-full bg-blue-500/10 p-1.5 sm:p-2">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-2xl sm:text-3xl font-bold">{oooToday}</div>
                </CardContent>
              </Card>
            </HoverLift>
          </Link>
        </StaggerItem>

        <StaggerItem>
          <Link href="/tasks?status=active">
            <HoverLift>
              <Card className="cursor-pointer bg-gradient-to-br from-amber-50 to-white border-amber-100 dark:from-amber-950/20 dark:to-background">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-6 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Ongoing Tasks</CardTitle>
                  <div className="rounded-full bg-amber-500/10 p-1.5 sm:p-2">
                    <ListTodo className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600" />
                  </div>
                </CardHeader>
                <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-2xl sm:text-3xl font-bold">{ongoingTasks}</div>
                </CardContent>
              </Card>
            </HoverLift>
          </Link>
        </StaggerItem>

        <StaggerItem>
          <HoverLift>
            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 dark:from-purple-950/20 dark:to-background">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-6 pb-1 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Tasks Completed</CardTitle>
                <div className="rounded-full bg-purple-500/10 p-1.5 sm:p-2">
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
                <div className="text-2xl sm:text-3xl font-bold">{orgHealth.tasksCompleted}</div>
              </CardContent>
            </Card>
          </HoverLift>
        </StaggerItem>
      </StaggerContainer>

      {/* Org Activity Heatmap */}
      <StaggerContainer delay={0.2}>
        <StaggerItem>
          <Card>
            <CardHeader className="p-2 sm:p-6 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                  Organization Activity
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  Last 30 days
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <ActivityHeatmap dailyActivity={orgHealth.dailyActivity} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4 pt-4 border-t">
                <div>
                  <p className="text-2xl font-bold">{orgHealth.uniqueActiveUsers}</p>
                  <p className="text-sm text-muted-foreground">Contributors</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{orgHealth.taskStatusUpdates}</p>
                  <p className="text-sm text-muted-foreground">Updates</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{orgHealth.approvalRate}%</p>
                  <p className="text-sm text-muted-foreground">Approval</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{orgHealth.extensionRequests}</p>
                  <p className="text-sm text-muted-foreground">Extensions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Two Column Layout */}
      <StaggerContainer className="grid gap-6 lg:grid-cols-2" delay={0.3}>
        {/* Top Contributors */}
        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Top Contributors
              </CardTitle>
              <p className="text-sm text-muted-foreground">Most active members in the last 30 days</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orgHealth.topContributors.slice(0, 5).map((member, index) => (
                  <Link 
                    key={member.userId} 
                    href={`/member/${member.userId}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium text-muted-foreground w-4">
                      {index + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getInitials(member.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">@{member.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.taskUpdates} updates, {member.tasksCompleted} completed
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {member.taskUpdates + member.progressUpdates}
                    </Badge>
                  </Link>
                ))}
                {orgHealth.topContributors.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                    <FolderOpenIcon size={28} animateOnMount className="text-muted-foreground/50" />
                    <span className="text-sm">No activity data yet</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* At-Risk Members */}
        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Members Needing Support
              </CardTitle>
              <p className="text-sm text-muted-foreground">Members with multiple extension requests</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orgHealth.atRiskMembers.slice(0, 5).map((member) => (
                  <Link 
                    key={member.userId} 
                    href={`/member/${member.userId}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getInitials(member.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">@{member.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.taskUpdates} task updates
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-amber-500 text-amber-600">
                      {member.extensionRequests} extensions
                    </Badge>
                  </Link>
                ))}
                {orgHealth.atRiskMembers.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500/50" />
                    <span className="text-sm">No members with multiple extension requests</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Task Flow Stats */}
      <StaggerContainer delay={0.4}>
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Task Flow (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {orgHealth.statusChanges.slice(0, 6).map((status) => (
                  <div key={status.status} className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{status.count}</p>
                    <p className="text-xs text-muted-foreground">{status.status.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
