'use client';

import { format } from 'date-fns';
import { ExternalLink, Github, Calendar, User, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { TaskRequest, TaskRequestUser } from '@/types';

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusStyle(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'DENIED':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'PENDING':
    default:
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  }
}

function getRequestTypeStyle(type: string) {
  switch (type) {
    case 'CREATION':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'ASSIGNMENT':
    default:
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
  }
}

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return 'Not set';
  try {
    return format(new Date(timestamp), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
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

function getDashboardUrl(taskRequestId: string): string {
  return `https://dashboard.realdevsquad.com/task-requests/details/?id=${taskRequestId}`;
}

// =============================================================================
// Component
// =============================================================================

interface TaskRequestDetailModalProps {
  taskRequest: TaskRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskRequestDetailModal({
  taskRequest,
  open,
  onOpenChange,
}: TaskRequestDetailModalProps) {
  if (!taskRequest) return null;

  const githubUrl = taskRequest.externalIssueHtmlUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-3 pr-8">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-left">{taskRequest.taskTitle || 'Untitled Task'}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Badges and GitHub Link */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn('text-xs', getRequestTypeStyle(taskRequest.requestType))}>
            {taskRequest.requestType}
          </Badge>
          <Badge className={cn('text-xs', getStatusStyle(taskRequest.status))}>
            {taskRequest.status}
          </Badge>
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              View Issue
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <Separator />

        {/* Requestors List */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Requestors ({taskRequest.usersCount || taskRequest.users?.length || 0})
          </h3>

          <div className="space-y-3">
            {taskRequest.users?.map((user: TaskRequestUser, index: number) => (
              <div
                key={user.userId || index}
                className="p-4 rounded-lg border bg-muted/30 space-y-3"
              >
                {/* User Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.picture} />
                      <AvatarFallback>
                        {getInitials(user.first_name, user.last_name, user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {user.first_name && user.last_name
                          ? `${user.first_name} ${user.last_name}`
                          : user.username || 'Unknown User'}
                      </p>
                      {user.username && (
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={cn('text-xs', getStatusStyle(user.status))}>
                    {user.status}
                  </Badge>
                </div>

                {/* Proposed Dates */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Start: {formatDate(user.proposedStartDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Deadline: {formatDate(user.proposedDeadline)}</span>
                  </div>
                </div>

                {/* Description */}
                {user.description && (
                  <div className="text-sm text-muted-foreground bg-background/50 p-3 rounded border">
                    <p className="italic">&ldquo;{user.description}&rdquo;</p>
                  </div>
                )}
              </div>
            ))}

            {(!taskRequest.users || taskRequest.users.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No requestor details available.
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Dashboard Link */}
        <div className="flex justify-end">
          <Button asChild>
            <a
              href={getDashboardUrl(taskRequest.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              Manage in Dashboard
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
