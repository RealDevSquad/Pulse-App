'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { FolderOpenIcon } from '@/components/ui/folder-open';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SkeletonPulse } from '@/components/ui/skeleton';
import { TaskActionsMenu } from '@/components/task-actions-menu';
import { TaskDetailModal } from '@/components/task-detail-modal';
import { cn, getStatusBadgeStyle, formatRelativeTime, isTaskUrgent, getTaskLatestActivity, isTaskUpdateStale } from '@/lib/utils';
import type { TaskWithAssignee } from '@/lib/tasks-cache';

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

interface TasksMobileCardsProps {
  tasks: TaskWithAssignee[];
  isRoot: boolean;
  isAdmin?: boolean;
  isOverdueTab?: boolean;
}

export function TasksMobileCards({ tasks, isRoot, isAdmin = false, isOverdueTab = false }: TasksMobileCardsProps) {
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCardClick = (task: TaskWithAssignee, e: React.MouseEvent) => {
    // Don't open modal if clicking on a link or button
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) return;
    
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <FolderOpenIcon size={32} animateOnMount className="text-muted-foreground/50" />
        <span>{isOverdueTab ? 'No overdue tasks found' : 'No tasks found'}</span>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-3">
      {tasks.map((task) => {
        const statusInfo = getStatusBadgeStyle(task.status);
        const latestActivity = getTaskLatestActivity(task);
        const updatedTime = formatRelativeTime(latestActivity);
        const isDone = task.status?.toUpperCase() === 'COMPLETED' || task.status?.toUpperCase() === 'DONE';
        const isUpdateStale = isTaskUpdateStale(task.status, latestActivity);
        
        const dueInfo = (() => {
          if (!task.endsOn || task.status?.toUpperCase() === 'BACKLOG') return null;
          const ms = task.endsOn > 1e12 ? task.endsOn : task.endsOn * 1000;
          const now = Date.now();
          const diff = ms - now;
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const isOverdue = days < 0 && !isDone;
          const isUrgent = isTaskUrgent(task.status, task.endsOn);
          let text: string;
          if (days < -365) text = isDone ? `${Math.floor(-days / 365)}y ago` : `${Math.floor(-days / 365)}y overdue`;
          else if (days < -30) text = isDone ? `${Math.floor(-days / 30)}mo ago` : `${Math.floor(-days / 30)}mo overdue`;
          else if (days < -7) text = isDone ? `${Math.floor(-days / 7)}w ago` : `${Math.floor(-days / 7)}w overdue`;
          else if (days < -1) text = isDone ? `${-days}d ago` : `${-days}d overdue`;
          else if (days === -1) text = isDone ? '1d ago' : '1d overdue';
          else if (days === 0) text = 'Today';
          else if (days === 1) text = 'Tomorrow';
          else if (days < 7) text = `In ${days}d`;
          else if (days < 30) text = `In ${Math.floor(days / 7)}w`;
          else text = `In ${Math.floor(days / 30)}mo`;
          return { text, isOverdue, isUrgent };
        })();

        return (
          <div 
            key={task.id} 
            className="p-4 rounded-lg bg-card border shadow-sm space-y-3 overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={(e) => handleCardClick(task, e)}
          >
            {/* Header: Title + Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground leading-snug line-clamp-2">
                  {task.title}
                </span>
              </div>
              <div className="shrink-0 flex flex-col gap-1">
                <span className={cn(statusInfo.className, 'text-xs')}>
                  {statusInfo.label}
                </span>
                {/* Progress bar for in-progress tasks */}
                {task.status?.toUpperCase() === 'IN_PROGRESS' && task.percentCompleted !== undefined && (() => {
                  const isUrgent = isTaskUrgent(task.status, task.endsOn);
                  return (
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isUrgent ? 'bg-red-500' : 'bg-primary'}`}
                          style={{ width: `${task.percentCompleted}%` }}
                        />
                      </div>
                      <span className={`text-xs tabular-nums ${isUrgent ? 'text-red-600' : 'text-muted-foreground'}`}>{task.percentCompleted}%</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Assignee + Due Date */}
            <div className="flex items-center justify-between gap-2">
              {task.assigneeUser ? (
                <Link 
                  href={`/member/${task.assignee}`} 
                  className="flex items-center gap-2 min-w-0 py-1 hover:text-primary transition-colors group"
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={task.assigneeUser.picture?.url} alt={task.assigneeUser.username} />
                    <AvatarFallback className="text-xs">
                      {getInitials(task.assigneeUser.first_name, task.assigneeUser.last_name, task.assigneeUser.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground group-hover:underline truncate">
                    {task.assigneeUser.first_name} {task.assigneeUser.last_name}
                  </span>
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
              {dueInfo && (
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                  dueInfo.isOverdue 
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                    : dueInfo.isUrgent
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-muted text-muted-foreground'
                )}>
                  {dueInfo.text}
                </span>
              )}
            </div>

            {/* Footer: Updated time + GitHub + Actions */}
            <div className="flex items-center justify-between gap-2">
              <span className={cn(
                "text-sm",
                isUpdateStale ? "text-orange-600 font-medium" : "text-muted-foreground/70"
              )}>{updatedTime}</span>
              <div className="flex items-center gap-1 shrink-0">
                {task.github?.issue?.html_url && (
                  <a
                    href={task.github.issue.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="View on GitHub"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {isRoot && (
                  <TaskActionsMenu
                    taskId={task.id}
                    taskTitle={task.title}
                    taskStatus={task.status}
                    taskType={task.type}
                    taskPriority={task.priority}
                    taskEndsOn={task.endsOn}
                    hasAssignee={!!task.assignee}
                    assigneeName={task.assigneeUser ? `${task.assigneeUser.first_name} ${task.assigneeUser.last_name}` : undefined}
                    assigneePicture={task.assigneeUser?.picture?.url}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>

    <TaskDetailModal
      task={selectedTask}
      open={isModalOpen}
      onOpenChange={setIsModalOpen}
      isAdmin={isAdmin}
    />
    </>
  );
}

/** Skeleton loading state for mobile cards */
export function TasksMobileCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg bg-card border shadow-sm space-y-3">
          {/* Header: Title + Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <SkeletonPulse className="h-5 w-full max-w-[250px]" />
              <SkeletonPulse className="h-5 w-3/4" />
            </div>
            <SkeletonPulse className="h-6 w-16 rounded-full shrink-0" />
          </div>

          {/* Assignee + Due Date */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SkeletonPulse className="h-6 w-6 rounded-full" />
              <SkeletonPulse className="h-4 w-24" />
            </div>
            <SkeletonPulse className="h-5 w-16 rounded-full" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2">
            <SkeletonPulse className="h-4 w-12" />
            <SkeletonPulse className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
