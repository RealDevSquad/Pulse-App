import { getTaskLifecycle, type LifecycleEvent, type LifecycleEventType } from '@/lib/task-lifecycle';
import { getStatusInfo, getPriorityInfo, getTaskTypeInfo, formatDueDate } from '@/lib/utils';
import { ArrowLeft, ExternalLink, Github, Clock, User, Calendar, TrendingUp, CheckCircle2, Circle, AlertCircle, ArrowRight, Plus, Minus, FileText, Timer } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

function getEventIcon(type: LifecycleEventType) {
  switch (type) {
    case 'CREATED':
      return <Plus className="h-4 w-4" />;
    case 'ASSIGNED':
      return <User className="h-4 w-4" />;
    case 'UNASSIGNED':
      return <Minus className="h-4 w-4" />;
    case 'STATUS_CHANGE':
      return <ArrowRight className="h-4 w-4" />;
    case 'PROGRESS_UPDATE':
      return <TrendingUp className="h-4 w-4" />;
    case 'DEADLINE_CHANGE':
      return <Calendar className="h-4 w-4" />;
    case 'EXTENSION_REQUESTED':
      return <Timer className="h-4 w-4" />;
    case 'EXTENSION_APPROVED':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'EXTENSION_DENIED':
      return <AlertCircle className="h-4 w-4" />;
    case 'TASK_REQUEST_CREATED':
      return <FileText className="h-4 w-4" />;
    case 'TASK_REQUEST_APPROVED':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'TASK_REQUEST_REJECTED':
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <Circle className="h-4 w-4" />;
  }
}

function getEventColor(type: LifecycleEventType): string {
  switch (type) {
    case 'CREATED':
      return 'bg-blue-500';
    case 'ASSIGNED':
    case 'TASK_REQUEST_APPROVED':
      return 'bg-green-500';
    case 'UNASSIGNED':
    case 'TASK_REQUEST_REJECTED':
    case 'EXTENSION_DENIED':
      return 'bg-red-500';
    case 'STATUS_CHANGE':
      return 'bg-purple-500';
    case 'PROGRESS_UPDATE':
      return 'bg-cyan-500';
    case 'DEADLINE_CHANGE':
    case 'EXTENSION_REQUESTED':
      return 'bg-yellow-500';
    case 'EXTENSION_APPROVED':
      return 'bg-green-500';
    case 'TASK_REQUEST_CREATED':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

function formatTimestamp(timestamp: number): { date: string; time: string } {
  const d = new Date(timestamp);
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return 'In future';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function TimelineEvent({ event, isLast }: { event: LifecycleEvent; isLast: boolean }) {
  const { date, time } = formatTimestamp(event.timestamp);
  const color = getEventColor(event.type);
  
  return (
    <div className="flex gap-3 sm:gap-4">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${color} text-white shrink-0`}>
          {getEventIcon(event.type)}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border my-1" />
        )}
      </div>
      
      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <p className="font-medium text-foreground">{event.details}</p>
          <div className="flex items-center gap-1.5 text-sm md:text-xs text-muted-foreground shrink-0">
            <span>{date}</span>
            <span className="hidden sm:inline">&middot;</span>
            <span>{time}</span>
          </div>
        </div>
        {event.actor && (
          <p className="text-sm text-muted-foreground mt-0.5">
            by @{event.actor}
          </p>
        )}
      </div>
    </div>
  );
}

export default async function TaskPage({ params }: PageProps) {
  const { id } = await params;
  
  const lifecycle = await getTaskLifecycle(id);
  
  if (!lifecycle) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">404 - Task Not Found</h1>
        <p className="text-muted-foreground">The task you&apos;re looking for doesn&apos;t exist.</p>
        <Button asChild>
          <Link href="/tasks">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tasks
          </Link>
        </Button>
      </div>
    );
  }

  const { task, events, stats } = lifecycle;
  const statusInfo = getStatusInfo(task.status);
  const priorityInfo = getPriorityInfo(task.priority);
  const typeInfo = getTaskTypeInfo(task.type);
  const dueDate = task.endsOn ? formatDueDate(task.endsOn, statusInfo.type === 'done') : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="min-h-11 md:min-h-0" asChild>
        <Link href="/tasks">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Link>
      </Button>

      {/* Task Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-2">
          <Badge variant="outline" className={statusInfo.badgeClass}>
            {statusInfo.label}
          </Badge>
          {task.type && (
            <Badge variant="outline" className={`border-current ${typeInfo.textClass}`}>
              {typeInfo.label}
            </Badge>
          )}
          {task.priority && (
            <Badge variant="outline" className={`border-current ${priorityInfo.textClass}`}>
              {priorityInfo.label}
            </Badge>
          )}
        </div>
        
        <h1 className="text-xl sm:text-2xl font-bold">{task.title}</h1>
        
        {/* Quick info row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {task.assigneeName && (
            <Link 
              href={`/member/${task.assignee}`}
              className="flex items-center gap-2 hover:text-foreground transition-colors py-2 -my-2"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={task.assigneePicture} alt={task.assigneeName} />
                <AvatarFallback className="text-xs">
                  {task.assigneeName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>@{task.assigneeName}</span>
            </Link>
          )}
          {dueDate && (
            <div className={`flex items-center gap-1.5 ${dueDate.isOverdue ? 'text-red-600' : ''}`}>
              <Calendar className="h-4 w-4" />
              <span>{dueDate.text}</span>
            </div>
          )}
          {task.percentCompleted !== undefined && task.percentCompleted > 0 && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span>{task.percentCompleted}% complete</span>
            </div>
          )}
        </div>

        {/* External links */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-8" asChild>
            <a
              href={`https://status.realdevsquad.com/tasks/${id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on RDS Status
            </a>
          </Button>
          {task.github?.issue?.html_url && (
            <Button variant="outline" size="sm" className="min-h-11 md:min-h-8" asChild>
              <a
                href={task.github.issue.html_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 mr-2" />
                View on GitHub
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.statusChanges}</p>
            <p className="text-sm md:text-xs text-muted-foreground">Status Changes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-cyan-600">{stats.progressUpdates}</p>
            <p className="text-sm md:text-xs text-muted-foreground">Progress Updates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.extensionRequests}</p>
            <p className="text-sm md:text-xs text-muted-foreground">Extensions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{events.length}</p>
            <p className="text-sm md:text-xs text-muted-foreground">Total Events</p>
          </CardContent>
        </Card>
      </div>

      {/* Time Stats */}
      {(stats.daysToStart !== undefined || stats.daysToComplete !== undefined) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-6">
              {stats.daysToStart !== undefined && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="font-medium">{stats.daysToStart}</span>
                    <span className="text-muted-foreground"> days to start</span>
                  </span>
                </div>
              )}
              {stats.daysToComplete !== undefined && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    <span className="font-medium">{stats.daysToComplete}</span>
                    <span className="text-muted-foreground"> days to complete</span>
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            Lifecycle Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {events.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No lifecycle events recorded for this task.
            </p>
          ) : (
            <div className="space-y-0">
              {events.map((event, index) => (
                <TimelineEvent
                  key={`${event.timestamp}-${event.type}-${index}`}
                  event={event}
                  isLast={index === events.length - 1}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
