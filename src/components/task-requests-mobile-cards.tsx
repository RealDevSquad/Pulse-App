'use client';

import { useState } from 'react';
import { ExternalLink, Github, Calendar, User, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SkeletonPulse } from '@/components/ui/skeleton';
import { TaskRequestDetailModal } from '@/components/task-request-detail-modal';
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

function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return 'Unknown';
  try {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return 'In future';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return 'Unknown';
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

// =============================================================================
// Component
// =============================================================================

interface TaskRequestsMobileCardsProps {
  taskRequests: TaskRequest[];
}

export function TaskRequestsMobileCards({ taskRequests }: TaskRequestsMobileCardsProps) {
  const [selectedRequest, setSelectedRequest] = useState<TaskRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCardClick = (request: TaskRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  if (taskRequests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No task requests found.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {taskRequests.map((request) => {
          const users = request.users || [];
          const count = request.usersCount || users.length;
          const displayUsers = users.slice(0, 3);
          const githubUrl = request.externalIssueHtmlUrl;

          return (
            <Card
              key={request.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleCardClick(request)}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header: Badges and Date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-xs', getRequestTypeStyle(request.requestType))}>
                      {request.requestType}
                    </Badge>
                    <Badge className={cn('text-xs', getStatusStyle(request.status))}>
                      {request.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatRelativeTime(request.createdAt)}
                  </div>
                </div>

                {/* Task Title */}
                <div className="space-y-1">
                  <h3 className="font-medium line-clamp-2">
                    {request.taskTitle || 'Untitled Task'}
                  </h3>
                  {githubUrl && (
                    <a
                      href={githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Github className="h-3 w-3" />
                      View Issue
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* Requestors */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="flex -space-x-2">
                      {displayUsers.map((user: TaskRequestUser, index: number) => (
                        <Avatar
                          key={user.userId || index}
                          className="h-6 w-6 border-2 border-background"
                        >
                          <AvatarImage src={user.picture} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user.first_name, user.last_name, user.username)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {count} {count === 1 ? 'requestor' : 'requestors'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <TaskRequestDetailModal
        taskRequest={selectedRequest}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

export function TaskRequestsMobileCardsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SkeletonPulse className="h-5 w-20 rounded-full" />
                <SkeletonPulse className="h-5 w-16 rounded-full" />
              </div>
              <SkeletonPulse className="h-4 w-16" />
            </div>
            <div className="space-y-2">
              <SkeletonPulse className="h-5 w-3/4" />
              <SkeletonPulse className="h-3 w-24" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SkeletonPulse className="h-4 w-4" />
                <div className="flex -space-x-2">
                  <SkeletonPulse className="h-6 w-6 rounded-full" />
                  <SkeletonPulse className="h-6 w-6 rounded-full" />
                </div>
                <SkeletonPulse className="h-4 w-20" />
              </div>
              <SkeletonPulse className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
